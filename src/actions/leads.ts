"use server";

import { prisma } from "@/lib/prisma";
import { assignProvidersToLead } from "@/lib/allocation";
import { leadsEmitter, LEAD_ASSIGNED_EVENT, QUOTA_RESET_EVENT } from "@/lib/events";
import { Prisma } from "@prisma/client";
import { v4 as uuid } from "uuid";


export async function submitLead(formData: FormData) {
  const name        = formData.get("name") as string;
  const phone       = formData.get("phone") as string;
  const city        = formData.get("city") as string;
  const serviceId   = parseInt(formData.get("serviceId") as string);
  const description = formData.get("description") as string;

  if (!name || !phone || !city || !serviceId || !description) {
    return { success: false, error: "All fields are required." };
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return { success: false, error: "Invalid service selected." };

  let lead;
  try {
    lead = await prisma.lead.create({
      data: { name, phone, city, serviceId, description },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        success: false,
        error: "You have already submitted a request for this service.",
      };
    }
    console.error("[submitLead] create error:", err);
    return { success: false, error: "Failed to create lead." };
  }

  let assigned;
  try {
    assigned = await assignProvidersToLead(lead.id, serviceId);
  } catch (err) {
    console.error("[submitLead] assignment error:", err);
    return { success: false, error: "Lead saved but provider assignment failed: " + (err instanceof Error ? err.message : String(err)) };
  }

  try {
    leadsEmitter.emit(LEAD_ASSIGNED_EVENT, {
      leadId: lead.id,
      serviceName: service.name,
      assignedProviders: assigned.map((p) => p.name),
    });
  } catch (err) {
    console.warn("[submitLead] SSE emit skipped:", err);
  }

  return {
    success: true,
    leadId: lead.id,
    assignedProviders: assigned.map((p) => p.name),
  };
}


export async function resetQuotaAction() {
  const eventId = uuid();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/webhook/reset-quota`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    }
  );
  return res.json();
}

export async function triggerWebhookMultiple(times: number = 3) {
  const eventId = uuid();
  const results = [];
  for (let i = 0; i < times; i++) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/webhook/reset-quota`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      }
    );
    results.push(await res.json());
  }
  return { eventId, results };
}

export async function generateBulkLeads(count: number = 10) {
  const services = await prisma.service.findMany();
  const promises = Array.from({ length: count }, (_, i) => {
    const service = services[i % services.length];
    return prisma.lead
      .create({
        data: {
          name: `Test User ${Date.now()}-${i}`,
          phone: `9${String(Date.now()).slice(-9)}${i}`,
          city: "Test City",
          serviceId: service.id,
          description: `Bulk test lead #${i + 1}`,
        },
      })
      .then(async (lead) => {
        const assigned = await assignProvidersToLead(lead.id, service.id);
        try {
          leadsEmitter.emit(LEAD_ASSIGNED_EVENT, {
            leadId: lead.id,
            serviceName: service.name,
            assignedProviders: assigned.map((p) => p.name),
          });
        } catch { /* no SSE client connected */ }
        return { success: true, leadId: lead.id, providers: assigned.map((p) => p.name) };
      });
  });

  const settled = await Promise.allSettled(promises);
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { success: false, index: i, error: String(r.reason) }
  );
}
