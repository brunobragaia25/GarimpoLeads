import { NextRequest, NextResponse } from "next/server";
import { findPendingEmails } from "@/lib/pipeline";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// Hunter.io free tier tem cota mensal baixa (poucas dezenas de buscas).
// Limitamos o processamento por chamada pra não estourar a cota sem querer.
const DEFAULT_LIMIT = 5;

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(body.limit ?? DEFAULT_LIMIT, 50);

  try {
    const result = await findPendingEmails(limit);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
