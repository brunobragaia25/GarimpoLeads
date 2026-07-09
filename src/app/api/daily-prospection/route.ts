import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeLeadsForQuery, analyzePendingSites, findPendingEmails } from "@/lib/pipeline";
import { sendFollowUps } from "@/lib/send-outreach";
import { getPairsForDay } from "@/config/prospection";

export const maxDuration = 300;

// Deixa margem de segurança pra sempre sobrar tempo de gravar o log final,
// mesmo que uma etapa individual demore mais que o previsto.
const TIME_BUDGET_MS = 260_000;

// Quantas combinações categoria+cidade rodar por dia. A Vercel Pro suporta
// até 300s de execução; com 6 pares o teste real ficou em 164s, então 10
// ainda cabe com folga. O loop já para sozinho se o tempo apertar.
const PAIRS_PER_DAY = 10;

// Raspagem direta do site roda pra todos os leads pendentes (sem limite de
// cota). Hunter.io só entra como fallback quando a raspagem não acha nada;
// free tier tem 50 buscas/mês, então 2/dia dá margem de segurança. O limite
// de escaneamento foi reduzido conforme a base de leads cresceu, pra caber
// no orçamento de tempo (cada lead custa 1 requisição HTTP).
const HUNTER_FALLBACK_PER_DAY = 2;
const SCRAPE_LIMIT_PER_DAY = 60;
const ANALYZE_LIMIT_PER_DAY = 20;

// Follow-up automático pra quem foi contatado e não respondeu.
const FOLLOWUP_DAYS_THRESHOLD = 5;
const FOLLOWUP_LIMIT_PER_DAY = 20;

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
  let followUpsSent = 0;
  let pairs: { category: string; location: string }[] = [];

  const timeLeft = () => TIME_BUDGET_MS - (Date.now() - startedAt);

  // Tudo dentro de um try/catch geral: se qualquer etapa (mesmo fora do
  // loop) lançar uma exceção não prevista, ainda assim conseguimos gravar
  // o log de execução em vez de perder o rastro do erro por completo.
  try {
    try {
      pairs = await getPairsForDay(new Date(), PAIRS_PER_DAY);
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      errors.push(`getPairsForDay: ${message}`);
    }

    for (const { category, location } of pairs) {
      if (timeLeft() < 30_000) {
        errors.push("scrape: parou por falta de tempo (orçamento de execução)");
        break;
      }
      try {
        const result = await scrapeLeadsForQuery(category, location);
        leadsFound += result.new_leads;
      } catch (err) {
        const message = err instanceof Error ? err.message : "erro desconhecido";
        errors.push(`scrape ${category}/${location}: ${message}`);
      }
    }

    if (timeLeft() > 15_000) {
      try {
        await analyzePendingSites(ANALYZE_LIMIT_PER_DAY);
      } catch (err) {
        const message = err instanceof Error ? err.message : "erro desconhecido";
        errors.push(`analyze-sites: ${message}`);
      }
    } else {
      errors.push("analyze-sites: pulado por falta de tempo");
    }

    if (timeLeft() > 15_000) {
      try {
        const emailResult = await findPendingEmails(HUNTER_FALLBACK_PER_DAY, SCRAPE_LIMIT_PER_DAY);
        emailsFound = emailResult.emails_found;
      } catch (err) {
        const message = err instanceof Error ? err.message : "erro desconhecido";
        errors.push(`find-emails: ${message}`);
      }
    } else {
      errors.push("find-emails: pulado por falta de tempo");
    }

    if (timeLeft() > 10_000) {
      try {
        const followUpResult = await sendFollowUps(FOLLOWUP_DAYS_THRESHOLD, FOLLOWUP_LIMIT_PER_DAY);
        followUpsSent = followUpResult.sent;
      } catch (err) {
        const message = err instanceof Error ? err.message : "erro desconhecido";
        errors.push(`follow-ups: ${message}`);
      }
    } else {
      errors.push("follow-ups: pulado por falta de tempo");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    errors.push(`erro geral inesperado: ${message}`);
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
    follow_ups_sent: followUpsSent,
    errors,
    duration_ms: durationMs,
  });
}
