import { NextRequest, NextResponse } from "next/server";
import { sendFollowUps } from "@/lib/send-outreach";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const daysThreshold = body.daysThreshold ?? 5;
  const limit = body.limit ?? 20;

  try {
    const result = await sendFollowUps(daysThreshold, limit);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
