import { NextRequest, NextResponse } from "next/server";
import { findPendingEmails } from "@/lib/pipeline";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// Raspagem direta do site não tem limite de cota; só o fallback via
// Hunter.io precisa ser limitado (cota mensal baixa no free tier).
const DEFAULT_HUNTER_LIMIT = 2;
const DEFAULT_SCRAPE_LIMIT = 100;

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const hunterLimit = Math.min(body.hunterLimit ?? DEFAULT_HUNTER_LIMIT, 50);
  const scrapeLimit = Math.min(body.scrapeLimit ?? DEFAULT_SCRAPE_LIMIT, 500);

  try {
    const result = await findPendingEmails(hunterLimit, scrapeLimit);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
