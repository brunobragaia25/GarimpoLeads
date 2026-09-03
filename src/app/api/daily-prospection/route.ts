import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeLeadsForQuery, analyzePendingSites, findPendingEmails } from "@/lib/pipeline";
import { sendPendingOutreach, sendFollowUps } from "@/lib/send-outreach";
import { sendPendingWhatsappTemplates, sendPendingWhatsappFollowUps } from "@/lib/send-whatsapp-outreach";
import { getPairsForDay } from "@/config/prospection";

export const maxDuration = 300;

// Interruptor manual de emergencia - true enquanto o envio automatico de
// WhatsApp estiver pausado (ver comentario mais abaixo, junto ao bloco que
// usa esta flag).
const WHATSAPP_AUTO_SEND_DISABLED = true;

// Deixa margem de segurança pra sempre sobrar tempo de gravar o log final,
// mesmo que uma etapa individual demore mais que o previsto.
const TIME_BUDGET_MS = 260_000;

// Quantas combinações categoria+cidade rodar por dia. Reduzido de 10 pra 5:
// o banco tem um backlog grande de leads que ainda não foram nem
// analisados nem tiveram email buscado, então vale mais desacelerar a
// entrada de leads novos e focar o orçamento de tempo em processar quem
// já está esperando. O loop já para sozinho se o tempo apertar.
const PAIRS_PER_DAY = 5;

// Análise e busca de email agora rodam em paralelo (ver mapWithConcurrency
// em pipeline.ts), então dá pra processar bem mais por dia dentro do mesmo
// orçamento de tempo. Hunter.io só entra como fallback quando a raspagem
// não acha nada; free tier tem 50 buscas/mês, então 2/dia dá margem.
const HUNTER_FALLBACK_PER_DAY = 2;
const SCRAPE_LIMIT_PER_DAY = 150;
const ANALYZE_LIMIT_PER_DAY = 150;

// Envio inicial de email pros leads com email encontrado - antes só rodava
// manualmente pelo botao do dashboard, nunca fazia parte do cron.
const EMAIL_SEND_LIMIT_PER_DAY = 100;

// Follow-up automático pra quem foi contatado e não respondeu.
const FOLLOWUP_DAYS_THRESHOLD = 5;
const FOLLOWUP_LIMIT_PER_DAY = 20;

// Limite passado aqui pra cada chamada individual - o teto de verdade do dia
// e o env var (WHATSAPP_DAILY_LIMIT), aplicado internamente em
// sendPendingWhatsappTemplates via Math.min. Esse numero soh precisa ser
// alto o suficiente pra nao virar ele mesmo o gargalo agora que rodam 2
// crons/dia - por isso segue igual ao teto diario total, nao 20 fixo.
const WHATSAPP_TEMPLATES_LIMIT_PER_DAY = 100;

// Follow-up automatico pra quem recebeu o template inicial e nunca respondeu.
const WHATSAPP_FOLLOWUP_DAYS_THRESHOLD = 5;
const WHATSAPP_FOLLOWUP_LIMIT_PER_DAY = 100;

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
  let emailsSent = 0;
  let followUpsSent = 0;
  let whatsappTemplatesSent = 0;
  let whatsappFollowUpsSent = 0;
  let pairs: { category: string; location: string }[] = [];

  const timeLeft = () => TIME_BUDGET_MS - (Date.now() - startedAt);
  // Prazo absoluto (epoch ms) pra passar pros loops de envio - eles checam
  // isso a cada mensagem, nao so o timeLeft() antes de comecar.
  const deadline = startedAt + TIME_BUDGET_MS;

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
        const outreachResult = await sendPendingOutreach(EMAIL_SEND_LIMIT_PER_DAY, undefined, deadline);
        emailsSent = outreachResult.sent;
      } catch (err) {
        const message = err instanceof Error ? err.message : "erro desconhecido";
        errors.push(`send-outreach: ${message}`);
      }
    } else {
      errors.push("send-outreach: pulado por falta de tempo");
    }

    if (timeLeft() > 10_000) {
      try {
        const followUpResult = await sendFollowUps(FOLLOWUP_DAYS_THRESHOLD, FOLLOWUP_LIMIT_PER_DAY, deadline);
        followUpsSent = followUpResult.sent;
      } catch (err) {
        const message = err instanceof Error ? err.message : "erro desconhecido";
        errors.push(`follow-ups: ${message}`);
      }
    } else {
      errors.push("follow-ups: pulado por falta de tempo");
    }

    // Envio automatico de WhatsApp pausado a pedido do usuario (conta Meta
    // sem forma de pagamento ativa - continuar mandando queima cota e/ou
    // gera cobranca sem entregar nada). Reativar removendo este if quando
    // o pagamento estiver resolvido.
    if (WHATSAPP_AUTO_SEND_DISABLED) {
      errors.push("whatsapp-templates: desativado manualmente");
      errors.push("whatsapp-followups: desativado manualmente");
    } else {
      if (timeLeft() > 10_000) {
        try {
          const whatsappResult = await sendPendingWhatsappTemplates(WHATSAPP_TEMPLATES_LIMIT_PER_DAY, deadline);
          whatsappTemplatesSent = whatsappResult.sent;
        } catch (err) {
          const message = err instanceof Error ? err.message : "erro desconhecido";
          errors.push(`whatsapp-templates: ${message}`);
        }
      } else {
        errors.push("whatsapp-templates: pulado por falta de tempo");
      }

      if (timeLeft() > 10_000) {
        try {
          const whatsappFollowUpResult = await sendPendingWhatsappFollowUps(
            WHATSAPP_FOLLOWUP_DAYS_THRESHOLD,
            WHATSAPP_FOLLOWUP_LIMIT_PER_DAY,
            deadline
          );
          whatsappFollowUpsSent = whatsappFollowUpResult.sent;
        } catch (err) {
          const message = err instanceof Error ? err.message : "erro desconhecido";
          errors.push(`whatsapp-followups: ${message}`);
        }
      } else {
        errors.push("whatsapp-followups: pulado por falta de tempo");
      }
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
    emails_sent: emailsSent,
    follow_ups_sent: followUpsSent,
    whatsapp_templates_sent: whatsappTemplatesSent,
    whatsapp_followups_sent: whatsappFollowUpsSent,
    errors,
    duration_ms: durationMs,
  });
}
