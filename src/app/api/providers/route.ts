import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      include: {
        assignments: {
          include: {
            lead: {
              include: { service: true },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: { id: "asc" },
    });

    const enriched = providers.map((p) => ({
      id: p.id,
      name: p.name,
      monthlyQuota: p.monthlyQuota,
      usedQuota: p.usedQuota,
      remainingQuota: p.monthlyQuota - p.usedQuota,
      leadsCount: p.assignments.length,
      leads: p.assignments.map((a) => ({
        assignmentId: a.id,
        leadId: a.leadId,
        leadName: a.lead.name,
        city: a.lead.city,
        serviceName: a.lead.service.name,
        phone: a.lead.phone,
        assignedAt: a.assignedAt,
      })),
    }));

    return NextResponse.json({ providers: enriched });
  } catch (err) {
    console.error("[GET /api/providers]", err);
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}
