import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeLeadsForQuery, analyzePendingSites, findPendingEmails } from "@/lib/pipeline";
import { getPairsForDay } from "@/config/prospection";

export const maxDuration = 300;

// Quantas combinações categoria+cidade rodar por dia. A Vercel Pro suporta
// até 300s de execução, então isso cabe com folga; ajuste se notar timeout.
const PAIRS_PER_DAY = 6;

// Hunter.io free tier: 50 buscas/mês ~ 1/dia com margem de segurança.
const EMAILS_PER_DAY = 1;

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const errors: string[] = [];
  let leadsFound = 0;
  let emailsFound = 0;

  const pairs = getPairsForDay(new Date(), PAIRS_PER_DAY);

  for (const { category, location } of pairs) {
    try {
      const result = await scrapeLeadsForQuery(category, location);
      leadsFound += result.new_leads;
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      errors.push(`scrape ${category}/${location}: ${message}`);
    }
  }

  try {
    await analyzePendingSites(30);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    errors.push(`analyze-sites: ${message}`);
  }

  try {
    const emailResult = await findPendingEmails(EMAILS_PER_DAY);
    emailsFound = emailResult.emails_found;
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    errors.push(`find-emails: ${message}`);
  }

  const durationMs = Date.now() - startedAt;

  await supabase.from("execution_logs").insert({
    leads_found: leadsFound,
    emails_found: emailsFound,
    errors: errors.length > 0 ? errors.join(" | ") : null,
    duration_ms: durationMs,
  });

  return NextResponse.json({
    pairs_processed: pairs,
    leads_found: leadsFound,
    emails_found: emailsFound,
    errors,
    duration_ms: durationMs,
  });
}
