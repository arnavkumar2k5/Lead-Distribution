import { NextResponse } from "next/server";
import { leadsEmitter, LEAD_ASSIGNED_EVENT, QUOTA_RESET_EVENT } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          closed = true;
        }
      };

      send("connected", { ts: Date.now() });

      const onLeadAssigned = (payload: unknown) => send(LEAD_ASSIGNED_EVENT, payload);
      const onQuotaReset   = (payload: unknown) => send(QUOTA_RESET_EVENT, payload);

      leadsEmitter.on(LEAD_ASSIGNED_EVENT, onLeadAssigned);
      leadsEmitter.on(QUOTA_RESET_EVENT, onQuotaReset);

      const heartbeat = setInterval(() => send("heartbeat", { ts: Date.now() }), 25_000);

      return () => {
        closed = true;
        clearInterval(heartbeat);
        leadsEmitter.off(LEAD_ASSIGNED_EVENT, onLeadAssigned);
        leadsEmitter.off(QUOTA_RESET_EVENT, onQuotaReset);
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
