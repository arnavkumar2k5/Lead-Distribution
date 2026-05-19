import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const services = await prisma.service.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ services });
  } catch (err) {
    console.error("[GET /api/services]", err);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}
