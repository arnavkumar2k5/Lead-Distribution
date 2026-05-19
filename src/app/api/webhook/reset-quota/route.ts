import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadsEmitter, QUOTA_RESET_EVENT } from "@/lib/events";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId } = body;

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "eventId is required in request body" },
        { status: 400 }
      );
    }

    try {
      await prisma.webhookEvent.create({
        data: { eventId, processed: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json({
          success: true,
          message: "Already processed (idempotent)",
          alreadyProcessed: true,
        });
      }
      throw err;
    }

    await prisma.$transaction(async (tx) => {
      await tx.provider.updateMany({
        data: { usedQuota: 0 },
      });
    });

    leadsEmitter.emit(QUOTA_RESET_EVENT, { eventId });

    return NextResponse.json({
      success: true,
      message: "All provider quotas reset to 0",
      alreadyProcessed: false,
    });
  } catch (err) {
    console.error("[POST /api/webhook/reset-quota]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
