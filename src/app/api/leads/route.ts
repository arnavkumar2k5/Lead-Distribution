import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignProvidersToLead } from "@/lib/allocation";
import { leadsEmitter, LEAD_ASSIGNED_EVENT } from "@/lib/events";
import { Prisma } from "@prisma/client";
import { z } from "zod";


const LeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(6, "Valid phone required"),
  city: z.string().min(1, "City is required"),
  serviceId: z.number().int().positive("Valid service required"),
  description: z.string().min(1, "Description is required"),
});


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, phone, city, serviceId, description } = parsed.data;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

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
        return NextResponse.json(
          { error: "A lead with this phone number for this service already exists." },
          { status: 409 }
        );
      }
      throw err;
    }

    const assignedProviders = await assignProvidersToLead(lead.id, serviceId);

    leadsEmitter.emit(LEAD_ASSIGNED_EVENT, {
      leadId: lead.id,
      serviceName: service.name,
      assignedProviders: assignedProviders.map((p) => p.name),
    });

    return NextResponse.json(
      {
        success: true,
        lead: { id: lead.id, name: lead.name },
        assignedProviders: assignedProviders.map((p) => ({
          id: p.id,
          name: p.name,
        })),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/leads]", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        service: true,
        assignments: { include: { provider: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ leads });
  } catch (err) {
    console.error("[GET /api/leads]", err);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
