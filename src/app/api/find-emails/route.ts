import { NextRequest, NextResponse } from "next/server";
import { findPendingEmails } from "@/lib/pipeline";
import { isCountry } from "@/lib/countries";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

const DEFAULT_SCRAPE_LIMIT = 100;

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const scrapeLimit = Math.min(body.scrapeLimit ?? DEFAULT_SCRAPE_LIMIT, 500);
  const country = isCountry(body.country) ? body.country : undefined;

  try {
    const result = await findPendingEmails(scrapeLimit, country);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
