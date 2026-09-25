import { NextRequest, NextResponse } from "next/server";
import { checkReplies } from "@/lib/reply-tracker";

export const maxDuration = 120;

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

// Body opcional: { days: 10, dryRun: true } - dryRun mostra o que casaria
// sem gravar nada nem avisar no Telegram.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await checkReplies({ days: Number(body.days) || 10, dryRun: body.dryRun === true }));
}
