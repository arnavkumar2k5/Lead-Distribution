# LeadFlow — Lead Distribution System

A production-ready, backend-focused lead distribution system built with Next.js App Router, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. Inspired by Urban Company / Justdial-style provider matching.

---

## Features

- **Automatic lead assignment** to exactly 3 providers per lead
- **Mandatory provider rules** per service (business rules enforced at DB layer)
- **Round-robin fair distribution** with persistent state across restarts
- **Concurrency-safe** using Serializable transactions + row-level locking
- **Idempotent webhook** for quota reset (WebhookEvent deduplication table)
- **Realtime dashboard** via Server-Sent Events (SSE) — no WebSocket needed
- **Duplicate lead prevention** via `UNIQUE(phone, serviceId)` constraint

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes + Server Actions |
| Database | PostgreSQL + Prisma ORM |
| Realtime | Server-Sent Events (SSE) via Node.js EventEmitter |

---

## Quick Setup

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (or any Postgres instance)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local and set your DATABASE_URL
```

### 3. Push schema to database
```bash
npm run db:push
```

### 4. Seed database
```bash
npm run db:seed
```

### 5. Start dev server
```bash
npm run dev
```

Visit: http://localhost:3000

---

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Provider dashboard with realtime updates |
| `/request-service` | Customer lead submission form |
| `/test-tools` | Test quota reset, idempotency, and bulk lead generation |

---

## Architecture

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── leads/route.ts          # POST/GET leads
│   │   ├── providers/route.ts      # GET provider dashboard data
│   │   ├── services/route.ts       # GET services list
│   │   ├── poll/stream/route.ts    # SSE endpoint for realtime
│   │   └── webhook/
│   │       └── reset-quota/route.ts # Idempotent quota reset webhook
│   ├── dashboard/page.tsx          # Provider dashboard UI
│   ├── request-service/page.tsx    # Customer form UI
│   └── test-tools/page.tsx         # Test utilities UI
├── lib/
│   ├── prisma.ts                   # Prisma singleton client
│   ├── allocation.ts               # Core distribution algorithm
│   └── events.ts                   # SSE EventEmitter singleton
├── hooks/
│   └── useRealtime.ts             # SSE client hook
└── actions/
    └── leads.ts                    # Server actions (form + test tools)
prisma/
├── schema.prisma                   # Database schema
└── seed.ts                        # Seed script
```

---

## Allocation Algorithm

### Business Rules

```
Service 1: Provider 1 (mandatory) + 2 from pool [2, 3, 4]
Service 2: Provider 5 (mandatory) + 2 from pool [6, 7, 8]
Service 3: Provider 1 + 4 (mandatory) + 1 from pool [2, 3, 5, 6, 7, 8]
```

### How Round-Robin Works

Each service has a persistent `AllocationState` row with a `lastIndex` integer. This is the pointer into the rotating pool array.

**Example — Service 1, pool = [P2, P3, P4]:**

```
Lead 1: lastIndex=0 → starts at P2 → assigns P2, P3 → nextIndex=2
Lead 2: lastIndex=2 → starts at P4 → assigns P4, P2 → nextIndex=1
Lead 3: lastIndex=1 → starts at P3 → assigns P3, P4 → nextIndex=0
```

The index wraps with modulo arithmetic. Providers with a full quota are skipped; the pointer still advances past them so they re-enter rotation once their quota resets.

The `lastIndex` is written back to the database inside the same transaction as the assignment, so the rotation is fully durable across server restarts.

---

## Concurrency Handling

### The Problem

Without locking, two simultaneous requests can:
1. Both read `lastIndex = 5`
2. Both compute "assign providers starting at index 5"
3. Both write `lastIndex = 7`
→ One rotation step is lost; same providers get picked twice

### The Solution

All assignment logic runs inside a **Serializable transaction**. Before reading `AllocationState`, we acquire a **row-level exclusive lock** using raw SQL:

```sql
SELECT id, "lastIndex"
FROM "AllocationState"
WHERE "serviceId" = $1
FOR UPDATE
```

`FOR UPDATE` means: "I intend to write this row. Block anyone else trying to read or write it until my transaction commits."

This serializes concurrent lead creation for the same service. The overall flow is:

```
Tx 1: LOCK AllocationState → read index 5 → assign → write index 7 → COMMIT
Tx 2:                        (blocked)   → read index 7 → assign → write index 9 → COMMIT
```

Both transactions succeed, each getting a distinct rotation slice.

**Additional safety nets:**
- `UNIQUE(leadId, providerId)` on `LeadAssignment` prevents duplicate assignments even if locking fails
- `UNIQUE(phone, serviceId)` on `Lead` prevents duplicate lead creation
- `Serializable` isolation level prevents phantom reads across concurrent transactions

---

## Webhook Idempotency

### Strategy: Insert-or-Reject

The `WebhookEvent` table has a `UNIQUE(eventId)` constraint. When the webhook fires:

1. Try to `INSERT INTO WebhookEvent (eventId, ...)`.
2. **If INSERT succeeds** → first time we've seen this event → execute quota reset.
3. **If INSERT fails with P2002 (unique violation)** → already processed → return 200 with `alreadyProcessed: true`.

This approach is safe under concurrent duplicate calls: only one INSERT can win the constraint race; the others are rejected deterministically by the database.

**Test it on the Test Tools page:** the "Trigger Webhook × 3" button sends the same `eventId` three times. You'll see in the log that only the first returns `alreadyProcessed: false`.

---

## Realtime Updates

The system uses **Server-Sent Events (SSE)** rather than WebSockets because:
- SSE is unidirectional (server → client) — fits the use case perfectly
- No WebSocket upgrade handshake; works through HTTP proxies
- Native browser support via `EventSource` API

### How It Works

1. Dashboard page calls `useRealtime()` hook, which opens `EventSource("/api/poll/stream")`
2. `GET /api/poll/stream` holds the HTTP response open and listens on a Node.js `EventEmitter` singleton
3. When `/api/leads` creates an assignment, it calls `leadsEmitter.emit("lead:assigned", ...)`
4. The stream handler receives the event and writes it to the SSE response
5. The browser's `EventSource` receives it and calls `onLeadAssigned()`, triggering a re-fetch

The `EventEmitter` is stored as a `globalThis` singleton so it survives Next.js hot-module-reload in development.

---

## Database Schema

```prisma
Service         (id, name)
Provider        (id, name, monthlyQuota, usedQuota)
Lead            (id, name, phone, city, description, serviceId, createdAt)
                UNIQUE(phone, serviceId)
LeadAssignment  (id, leadId, providerId, assignedAt)
                UNIQUE(leadId, providerId)
AllocationState (id, serviceId, lastIndex)
WebhookEvent    (id, eventId, processed, createdAt)
                UNIQUE(eventId)
```
