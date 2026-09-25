import { NextRequest, NextResponse } from "next/server";
import { runPageSpeedForPending } from "@/lib/pipeline";

export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

// Roda o PageSpeed na hora (backfill). Body opcional: { limit }.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 8, 40);
  try {
    return NextResponse.json(await runPageSpeedForPending(limit, Date.now() + 280_000));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "erro desconhecido" }, { status: 500 });
  }
}
