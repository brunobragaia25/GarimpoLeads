import { supabase } from "./supabase";
import {
  categoryTemplateKey,
  getTemplate,
  getFollowUpTemplate,
  type MessageTemplate,
  type SiteAnalysisSummary,
} from "./template";
import { sendOutreachEmail } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import { startOfTodayBrasiliaISO } from "./timezone";
import { COUNTRY_CODES, parseCountry, type Country } from "./countries";
import { buildOutreachEmail } from "./outreach-email";

// Busca a análise mais recente de cada lead (pode ter mais de uma linha ao
// longo do tempo) e devolve um Map lead_id -> achados, pra montar o
// {{problema}} do email com algo real em vez de texto genérico.
async function fetchLatestAnalysisByLead(leadIds: string[]): Promise<Map<string, SiteAnalysisSummary>> {
  const map = new Map<string, SiteAnalysisSummary>();
  if (leadIds.length === 0) return map;

  const { data: analyses } = await supabase
    .from("site_analysis")
    .select("lead_id, performance_score, is_slow, is_outdated, is_wordpress, is_broken, broken_reason, notes, ps_mobile_score, ps_lcp_ms, analyzed_at")
    .in("lead_id", leadIds)
    .order("analyzed_at", { ascending: false });

  for (const a of analyses ?? []) {
    if (!map.has(a.lead_id)) map.set(a.lead_id, a);
  }
  return map;
}

async function buildTemplateResolver() {
  const cache = new Map<string, MessageTemplate>();
  return async (category: string, country: Country): Promise<MessageTemplate> => {
    const key = `${country}:${category}`;
    if (!cache.has(key)) {
      cache.set(key, await getTemplate(categoryTemplateKey(category, country), country));
    }
    return cache.get(key)!;
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

function unsubscribeLink(leadId: string, token: string, country: Country): string {
  return `${process.env.APP_URL}/api/unsubscribe?lead=${leadId}&token=${token}&country=${country}`;
}

export async function sendPendingOutreach(
  limit = 100,
  leadId?: string,
  deadline = Infinity,
  country?: Country
) {
  const resolveTemplate = await buildTemplateResolver();
  const dailyLimit = Number(process.env.SEND_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;

  const alreadySentToday = await countSentToday();
  const remainingToday = Math.max(0, dailyLimit - alreadySentToday);
  const effectiveLimit = Math.min(limit, remainingToday);

  if (effectiveLimit === 0) {
    return {
      sent: 0,
      failed: 0,
      blocked: 0,
      total: 0,
      daily_limit_reached: true,
      sent_today: alreadySentToday,
      daily_limit: dailyLimit,
    };
  }

  // `!inner` faz os filtros em leads.* (website, country) valerem de verdade
  // - join normal deixaria a linha de outreach passar mesmo sem bater o
  // filtro do lado relacionado. O filtro de pais e usado pelo cron (metade
  // da cota pra cada pais) e em chamadas manuais.
  let query = supabase
    .from("outreach")
    .select("id, lead_id, email, leads!inner(name, category, address, country, website)")
    .eq("status", "pending")
    .not("email", "is", null)
    // Automatico so pra lead COM site: o texto fala "dei uma olhada no seu
    // site". Lead sem site (e-mail cadastrado na mao) recebe o pitch de
    // site novo, manualmente, pela Fila de Email.
    .not("leads.website", "is", null)
    .order("created_at", { ascending: true });

  if (leadId) {
    query = query.eq("lead_id", leadId);
  }
  if (country) {
    query = query.eq("leads.country", country);
  }

  // Janela maior que o limite: lead barrado pela checagem de qualidade
  // fica pra tras sem ocupar a vaga dos que podem sair (senao o mesmo lote
  // barrado travaria a fila inteira, como ja aconteceu com a busca de e-mail).
  const { data: rows, error } = await query.limit(effectiveLimit * 3);

  if (error) throw new Error(error.message);

  const analysisByLead = await fetchLatestAnalysisByLead((rows ?? []).map((r) => r.lead_id));

  let sent = 0;
  let failed = 0;
  let blocked = 0;

  for (const row of rows ?? []) {
    // Checa a cada email, nao so antes de comecar - protege contra a soma
    // dos envios estourar o limite de execucao da funcao antes de terminar
    // o lote (o resto fica pro proximo cron).
    if (Date.now() > deadline) break;
    if (sent + failed >= effectiveLimit) break;

    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    if (!lead || !row.email) continue;

    const country = parseCountry(lead.country);
    const template = await resolveTemplate(lead.category, country);
    const token = await createUnsubscribeToken(row.lead_id);
    const link = unsubscribeLink(row.lead_id, token, country);
    const email = buildOutreachEmail({
      template,
      country,
      unsubscribeLink: link,
      lead,
      analysis: analysisByLead.get(row.lead_id) ?? null,
    });

    if (email.blocking.length > 0) {
      blocked++;
      await supabase
        .from("outreach")
        .update({ notes: `Bloqueado pela checagem: ${email.blocking.join("; ")}` })
        .eq("id", row.id);
      continue;
    }

    try {
      await sendOutreachEmail(row.email, email.subject, email.body, link);
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
    blocked,
    total: (rows ?? []).length,
    daily_limit_reached: false,
    sent_today: alreadySentToday + sent,
    daily_limit: dailyLimit,
  };
}

// Reenvia pra quem foi contatado há mais de `daysThreshold` dias e ainda não
// recebeu follow-up. Compartilha a mesma cota diária dos envios iniciais.
export async function sendFollowUps(daysThreshold = 5, limit = 20, deadline = Infinity, country?: Country) {
  const dailyLimit = Number(process.env.SEND_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const alreadySentToday = await countSentToday();
  const remainingToday = Math.max(0, dailyLimit - alreadySentToday);
  const effectiveLimit = Math.min(limit, remainingToday);

  if (effectiveLimit === 0) {
    return { sent: 0, failed: 0, blocked: 0, total: 0 };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);

  let query = supabase
    .from("outreach")
    .select("id, lead_id, email, leads!inner(name, category, address, country, website)")
    .eq("status", "contacted")
    .is("follow_up_sent_at", null)
    .not("leads.website", "is", null)
    .lte("contacted_at", cutoff.toISOString())
    .not("email", "is", null)
    .order("contacted_at", { ascending: true })
    .limit(effectiveLimit * 3);

  if (country) {
    query = query.eq("leads.country", country);
  }

  const { data: rows, error } = await query;

  if (error) throw new Error(error.message);

  const followUpTemplateByCountry = Object.fromEntries(
    await Promise.all(COUNTRY_CODES.map(async (c) => [c, await getFollowUpTemplate(c)] as const))
  ) as Record<Country, MessageTemplate>;
  const analysisByLead = await fetchLatestAnalysisByLead((rows ?? []).map((r) => r.lead_id));
  let sent = 0;
  let failed = 0;
  let blocked = 0;

  for (const row of rows ?? []) {
    if (Date.now() > deadline) break;
    if (sent + failed >= effectiveLimit) break;

    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    if (!lead || !row.email) continue;

    const country = parseCountry(lead.country);
    const token = await createUnsubscribeToken(row.lead_id);
    const link = unsubscribeLink(row.lead_id, token, country);
    const email = buildOutreachEmail({
      template: followUpTemplateByCountry[country],
      country,
      unsubscribeLink: link,
      lead,
      analysis: analysisByLead.get(row.lead_id) ?? null,
    });

    if (email.blocking.length > 0) {
      blocked++;
      await supabase
        .from("outreach")
        .update({ notes: `Follow-up bloqueado pela checagem: ${email.blocking.join("; ")}` })
        .eq("id", row.id);
      continue;
    }

    try {
      await sendOutreachEmail(row.email, email.subject, email.body, link);
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

  return { sent, failed, blocked, total: (rows ?? []).length };
}

export interface OutreachPreview {
  outreachId: string;
  leadId: string;
  to: string;
  leadName: string;
  category: string;
  country: Country;
  website: string | null;
  subject: string;
  body: string;
  blocking: string[];
  warnings: string[];
  previousNote: string | null;
}

// Mesma consulta e mesma montagem do envio real (sendPendingOutreach), mas
// sem enviar nem gravar nada: mostra os proximos e-mails do pais, como
// sairiam. `limit` e o tamanho da vitrine, nao a cota do dia.
export async function previewPendingOutreach(country: Country, limit = 10): Promise<OutreachPreview[]> {
  const resolveTemplate = await buildTemplateResolver();
  const { data: rows, error } = await supabase
    .from("outreach")
    .select("id, lead_id, email, notes, leads!inner(name, category, address, country, website)")
    .eq("status", "pending")
    .not("email", "is", null)
    .not("leads.website", "is", null)
    .eq("leads.country", country)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const analysisByLead = await fetchLatestAnalysisByLead((rows ?? []).map((r) => r.lead_id));
  const previews: OutreachPreview[] = [];
  for (const row of rows ?? []) {
    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    if (!lead || !row.email) continue;
    const template = await resolveTemplate(lead.category, country);
    const token = await createUnsubscribeToken(row.lead_id);
    const email = buildOutreachEmail({
      template,
      country,
      unsubscribeLink: unsubscribeLink(row.lead_id, token, country),
      lead,
      analysis: analysisByLead.get(row.lead_id) ?? null,
    });
    previews.push({
      outreachId: row.id,
      leadId: row.lead_id,
      to: row.email,
      leadName: lead.name,
      category: lead.category,
      country,
      website: lead.website,
      subject: email.subject,
      body: email.body,
      blocking: email.blocking,
      warnings: email.warnings,
      previousNote: row.notes,
    });
  }
  return previews;
}
