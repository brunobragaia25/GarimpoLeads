import { supabase } from "./supabase";
import {
  getTemplate,
  getFollowUpTemplate,
  renderTemplate,
  buildProblemSummary,
  type MessageTemplate,
  type SiteAnalysisSummary,
} from "./template";
import { sendOutreachEmail } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import { startOfTodayBrasiliaISO } from "./timezone";

// Busca a análise mais recente de cada lead (pode ter mais de uma linha ao
// longo do tempo) e devolve um Map lead_id -> achados, pra montar o
// {{problema}} do email com algo real em vez de texto genérico.
async function fetchLatestAnalysisByLead(leadIds: string[]): Promise<Map<string, SiteAnalysisSummary>> {
  const map = new Map<string, SiteAnalysisSummary>();
  if (leadIds.length === 0) return map;

  const { data: analyses } = await supabase
    .from("site_analysis")
    .select("lead_id, performance_score, is_slow, is_outdated, is_wordpress, is_broken, broken_reason, notes, analyzed_at")
    .in("lead_id", leadIds)
    .order("analyzed_at", { ascending: false });

  for (const a of analyses ?? []) {
    if (!map.has(a.lead_id)) map.set(a.lead_id, a);
  }
  return map;
}

async function buildTemplateResolver() {
  const cache = new Map<string, MessageTemplate>();
  return async (category: string): Promise<MessageTemplate> => {
    if (!cache.has(category)) {
      cache.set(category, await getTemplate(category));
    }
    return cache.get(category)!;
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Domínio recém-verificado: começa devagar pra construir reputação de envio
// antes de escalar. Ajustável via env var conforme a reputação for subindo.
const DEFAULT_DAILY_LIMIT = 30;

// Envios iniciais e follow-ups dividem a mesma cota diária, pra proteger a
// reputação do domínio como um todo (não só o primeiro contato). Filtra por
// email presente: leads sem email marcados como "contacted" manualmente
// (contato feito por WhatsApp, fora deste sistema) não gastam cota nenhuma
// - so envio de EMAIL de verdade conta pro limite diario.
async function countSentToday(): Promise<number> {
  const iso = startOfTodayBrasiliaISO();

  // Conta por contacted_at, SEM filtrar por status: um lead contatado hoje
  // que já deu bounce/respondeu/descadastrou no mesmo dia gastou cota do
  // mesmo jeito - filtrar por status "contacted" faria essa cota "voltar"
  // e o limite diário de reputação seria furado.
  const { count: initial } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null)
    .gte("contacted_at", iso);

  const { count: followUps } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null)
    .gte("follow_up_sent_at", iso);

  return (initial ?? 0) + (followUps ?? 0);
}

function unsubscribeLink(leadId: string, token: string): string {
  return `${process.env.APP_URL}/api/unsubscribe?lead=${leadId}&token=${token}`;
}

function appendUnsubscribeFooter(body: string, link: string): string {
  return `${body}\n\n---\nSe não quiser mais receber esses emails, clique aqui: ${link}`;
}

export async function sendPendingOutreach(limit = 100, leadId?: string, deadline = Infinity) {
  const resolveTemplate = await buildTemplateResolver();
  const dailyLimit = Number(process.env.SEND_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;

  const alreadySentToday = await countSentToday();
  const remainingToday = Math.max(0, dailyLimit - alreadySentToday);
  const effectiveLimit = Math.min(limit, remainingToday);

  if (effectiveLimit === 0) {
    return {
      sent: 0,
      failed: 0,
      total: 0,
      daily_limit_reached: true,
      sent_today: alreadySentToday,
      daily_limit: dailyLimit,
    };
  }

  let query = supabase
    .from("outreach")
    .select("id, lead_id, email, leads(name, category, address)")
    .eq("status", "pending")
    .not("email", "is", null)
    .order("created_at", { ascending: true });

  if (leadId) {
    query = query.eq("lead_id", leadId);
  }

  const { data: rows, error } = await query.limit(effectiveLimit);

  if (error) throw new Error(error.message);

  const analysisByLead = await fetchLatestAnalysisByLead((rows ?? []).map((r) => r.lead_id));

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    // Checa a cada email, nao so antes de comecar - protege contra a soma
    // dos envios estourar o limite de execucao da funcao antes de terminar
    // o lote (o resto fica pro proximo cron).
    if (Date.now() > deadline) break;

    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    if (!lead || !row.email) continue;

    const template = await resolveTemplate(lead.category);
    const rendered = renderTemplate(template, {
      name: lead.name,
      category: lead.category,
      address: lead.address,
      problem: buildProblemSummary(analysisByLead.get(row.lead_id) ?? null),
    });
    const token = await createUnsubscribeToken(row.lead_id);
    const link = unsubscribeLink(row.lead_id, token);
    const bodyWithFooter = appendUnsubscribeFooter(rendered.body, link);

    try {
      await sendOutreachEmail(row.email, rendered.subject, bodyWithFooter, link);
      await supabase
        .from("outreach")
        .update({ status: "contacted", contacted_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      await supabase.from("outreach").update({ notes: `Falha no envio: ${message}` }).eq("id", row.id);
      failed++;
    }

    // Resend free tier tem limite de ~2 req/s; respeita esse ritmo.
    await sleep(600);
  }

  return {
    sent,
    failed,
    total: (rows ?? []).length,
    daily_limit_reached: false,
    sent_today: alreadySentToday + sent,
    daily_limit: dailyLimit,
  };
}

// Reenvia pra quem foi contatado há mais de `daysThreshold` dias e ainda não
// recebeu follow-up. Compartilha a mesma cota diária dos envios iniciais.
export async function sendFollowUps(daysThreshold = 5, limit = 20, deadline = Infinity) {
  const dailyLimit = Number(process.env.SEND_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const alreadySentToday = await countSentToday();
  const remainingToday = Math.max(0, dailyLimit - alreadySentToday);
  const effectiveLimit = Math.min(limit, remainingToday);

  if (effectiveLimit === 0) {
    return { sent: 0, failed: 0, total: 0 };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);

  const { data: rows, error } = await supabase
    .from("outreach")
    .select("id, lead_id, email, leads(name, category, address)")
    .eq("status", "contacted")
    .is("follow_up_sent_at", null)
    .lte("contacted_at", cutoff.toISOString())
    .not("email", "is", null)
    .order("contacted_at", { ascending: true })
    .limit(effectiveLimit);

  if (error) throw new Error(error.message);

  const template = await getFollowUpTemplate();
  const analysisByLead = await fetchLatestAnalysisByLead((rows ?? []).map((r) => r.lead_id));
  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    if (Date.now() > deadline) break;

    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    if (!lead || !row.email) continue;

    const rendered = renderTemplate(template, {
      name: lead.name,
      category: lead.category,
      address: lead.address,
      problem: buildProblemSummary(analysisByLead.get(row.lead_id) ?? null),
    });
    const token = await createUnsubscribeToken(row.lead_id);
    const link = unsubscribeLink(row.lead_id, token);
    const bodyWithFooter = appendUnsubscribeFooter(rendered.body, link);

    try {
      await sendOutreachEmail(row.email, rendered.subject, bodyWithFooter, link);
      await supabase
        .from("outreach")
        .update({ follow_up_sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      await supabase
        .from("outreach")
        .update({ notes: `Falha no follow-up: ${message}` })
        .eq("id", row.id);
      failed++;
    }

    await sleep(600);
  }

  return { sent, failed, total: (rows ?? []).length };
}
