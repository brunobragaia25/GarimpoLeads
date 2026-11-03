import { supabase } from "./supabase";
import { hasWhatsappAccount, sendWhatsappText, toWhatsappPhone } from "./whatsapp";
import { isMobilePhone } from "./phone";
import { detectSocialPlatform } from "./social-link";
import { startOfTodayBrasiliaISO } from "./timezone";
import {
  buildProblemSummary,
  categoryTemplateKey,
  getNoSiteTemplates,
  getTemplate,
  getWhatsappFollowUpTemplate,
  renderTemplate,
  type MessageTemplate,
  type SiteAnalysisSummary,
} from "./template";
import { fetchBlockedPhones } from "./blocklist";
import { normalizePhone } from "./deduplication";
import { isWhatsappSendingPaused } from "./app-settings";

// Pausa aleatoria entre um envio e outro - rajada de mensagens identicas em
// sequencia e o padrao que o anti-spam do WhatsApp mais pega num numero
// conectado via WhatsApp Web (Evolution).
const MIN_DELAY_MS = 8_000;
const MAX_DELAY_MS = 20_000;

function randomDelay(): Promise<void> {
  const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

const DEFAULT_DAILY_LIMIT = 20;

// O PostgREST do Supabase trunca qualquer resposta em 1000 linhas (config
// "Max Rows" do projeto) mesmo com `.limit()` maior no client - sem paginar
// com `.range()`, as buscas abaixo passavam a ignorar todo registro além da
// linha 1000, arriscando reenviar template pra quem já tinha conversa.
const POSTGREST_PAGE_SIZE = 1000;

async function fetchAllColumn(table: string, column: string): Promise<string[]> {
  const rows: string[] = [];

  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows.push(...(data as any[]).map((r) => r[column]));
    if (data.length < POSTGREST_PAGE_SIZE) break;
  }

  return rows;
}

interface CandidateLead {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  has_whatsapp: boolean | null;
}

// Envio inicial e follow-up dividem a mesma cota diaria (mesmo padrao do
// email em send-outreach.ts), pra proteger a qualidade/reputacao do numero
// como um todo, nao so o primeiro contato.
async function countTemplatesSentToday(): Promise<number> {
  const iso = startOfTodayBrasiliaISO();

  const { count: initial } = await supabase
    .from("whatsapp_conversations")
    .select("*", { count: "exact", head: true })
    .gte("template_sent_at", iso);

  const { count: followUps } = await supabase
    .from("whatsapp_conversations")
    .select("*", { count: "exact", head: true })
    .gte("followup_sent_at", iso);

  return (initial ?? 0) + (followUps ?? 0);
}

// Primeira mensagem (texto livre via Evolution) pra leads elegiveis com
// WhatsApp que ainda nao tem conversa iniciada. Mesmos textos da fila
// manual de WhatsApp (editaveis em /template), com as variacoes {a|b}.
// Espelha a estrutura de sendPendingOutreach em send-outreach.ts, mas pro
// canal WhatsApp em vez de email.
export async function sendPendingWhatsappTemplates(limit = 20, deadline = Infinity) {
  // Pausa manual (app_settings) - liga quando a entrega esta quebrada (ex:
  // numero desconectado ou restrito pelo WhatsApp) pra nao ficar
  // queimando a cota diaria mandando mensagem que nunca chega em ninguem.
  if (await isWhatsappSendingPaused()) {
    return { sent: 0, failed: 0, total: 0, daily_limit_reached: false, sent_today: 0, daily_limit: 0, paused: true };
  }

  const dailyLimit = Number(process.env.WHATSAPP_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const alreadySentToday = await countTemplatesSentToday();
  const remainingToday = Math.max(0, dailyLimit - alreadySentToday);
  const effectiveLimit = Math.min(limit, remainingToday);

  if (effectiveLimit === 0) {
    return { sent: 0, failed: 0, total: 0, daily_limit_reached: true, sent_today: alreadySentToday, daily_limit: dailyLimit };
  }

  const existingLeadIds = new Set(await fetchAllColumn("whatsapp_conversations", "lead_id"));

  // Ultima trava contra reenvio: mesmo que um lead excluido tenha voltado
  // com id novo (nao deveria mais, com o bloqueio em pipeline.ts), o
  // telefone continua bloqueado pra sempre.
  const blockedPhones = await fetchBlockedPhones();

  // Janela grande + filtro em memoria depois: mesmo padrao ja usado em
  // findPendingEmails/analyzePendingSites pra nao travar nos leads mais
  // antigos quando eles ja tiverem todos conversa iniciada.
  const leads: CandidateLead[] = [];
  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    const { data, error: leadsError } = await supabase
      .from("leads")
      .select("id, name, category, phone, website, address, has_whatsapp")
      .eq("country", "BR")
      .not("phone", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1);
    if (leadsError) throw new Error(leadsError.message);
    if (!data || data.length === 0) break;

    leads.push(...data);
    if (data.length < POSTGREST_PAGE_SIZE) break;
  }

  // Usa isMobilePhone (estrito) em vez de hasUsablePhone (permissivo) aqui -
  // dado real: 133 de 156 falhas de entrega eram numero com cara de fixo,
  // que nunca vai ter WhatsApp. Cada tentativa nesses ocupa uma vaga da cota
  // diaria fixa (100/dia) que podia ir pra um celular de verdade. Perde
  // alguns casos raros de WhatsApp Business em numero de fixo/VoIP, mas o
  // volume de fixo morto e muito maior que esse caso raro.
  const eligible = leads
    .filter((l): l is CandidateLead => !existingLeadIds.has(l.id))
    .filter((l) => isMobilePhone(l.phone))
    // Ja conferido antes e sem conta de WhatsApp - nao checa de novo todo dia.
    .filter((l) => l.has_whatsapp !== false)
    .filter((l) => detectSocialPlatform(l.website) === null)
    .filter((l) => {
      const phone = normalizePhone(l.phone);
      return !phone || !blockedPhones.has(phone);
    });

  // Prioriza quem nao tem site - e o foco principal do negocio (prospect
  // direto pra vender site do zero), mesmo padrao ja usado em
  // analyzePendingSites. Dentro de cada grupo mantem a ordem cronologica
  // (mais antigo primeiro).
  // Nao corta no limite aqui: numero sem WhatsApp e pulado no loop sem
  // contar como envio, entao a fila anda ate bater a cota.
  const noWebsite = eligible.filter((l) => !l.website);
  const withWebsite = eligible.filter((l) => !!l.website);
  const pending = [...noWebsite, ...withWebsite];

  const noSiteTemplates = await getNoSiteTemplates([...new Set(noWebsite.map((l) => l.category))], "BR");
  const siteTemplates = new Map<string, MessageTemplate>();

  let sent = 0;
  let failed = 0;
  let attempted = 0;

  for (const lead of pending) {
    if (sent >= effectiveLimit) break;
    // Checa a cada mensagem, nao so antes de comecar o loop - sem isso, se
    // muitos envios demorarem (mesmo com timeout por chamada), a soma pode
    // estourar o limite de execucao da Vercel antes de terminar o lote
    // inteiro, matando a funcao sem nunca gravar o log final. O resto fica
    // pro proximo cron (agora 2x/dia).
    if (Date.now() + MAX_DELAY_MS > deadline) break;
    attempted++;

    try {
      if (!(await hasWhatsappAccount(lead.phone!))) {
        await supabase.from("leads").update({ has_whatsapp: false }).eq("id", lead.id);
        continue;
      }

      let template = noSiteTemplates.get(lead.category);
      let problem: string | undefined;
      if (lead.website) {
        template = siteTemplates.get(lead.category);
        if (!template) {
          template = await getTemplate(categoryTemplateKey(lead.category, "BR"), "BR");
          siteTemplates.set(lead.category, template);
        }
        const analysis = (await fetchLatestAnalysisByLead([lead.id])).get(lead.id) ?? null;
        problem = buildProblemSummary(analysis);
      }
      if (!template) continue;

      const text = renderTemplate(template, {
        name: lead.name,
        category: lead.category,
        address: lead.address,
        problem,
      }).body;

      if (sent > 0) await randomDelay();
      const waMessageId = await sendWhatsappText(lead.phone!, text);
      const now = new Date().toISOString();
      const { data: conversation, error: insertError } = await supabase
        .from("whatsapp_conversations")
        .insert({
          lead_id: lead.id,
          phone: toWhatsappPhone(lead.phone!),
          template_sent_at: now,
          last_outbound_at: now,
          status: "template_sent",
        })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);

      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        direction: "outbound",
        body: text,
        wa_message_id: waMessageId,
      });

      sent++;
    } catch {
      // Falha no envio (instancia desconectada, numero invalido, etc.) -
      // nao grava conversa, entao o lead e retentado no proximo dia.
      failed++;
    }
  }

  return {
    sent,
    failed,
    total: attempted,
    daily_limit_reached: false,
    sent_today: alreadySentToday + sent,
    daily_limit: dailyLimit,
  };
}

// Follow-up pra quem recebeu a mensagem inicial ha X dias e nunca respondeu
// nada (last_inbound_at continua null).
export async function sendPendingWhatsappFollowUps(daysThreshold = 5, limit = 20, deadline = Infinity) {
  if (await isWhatsappSendingPaused()) {
    return { sent: 0, failed: 0, total: 0, paused: true };
  }

  const dailyLimit = Number(process.env.WHATSAPP_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const alreadySentToday = await countTemplatesSentToday();
  const remainingToday = Math.max(0, dailyLimit - alreadySentToday);
  const effectiveLimit = Math.min(limit, remainingToday);

  if (effectiveLimit === 0) {
    return { sent: 0, failed: 0, total: 0 };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);

  const { data: rows, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone, lead_id, leads(name, category, address)")
    .is("last_inbound_at", null)
    .is("followup_sent_at", null)
    .is("deleted_at", null)
    .lte("template_sent_at", cutoff.toISOString())
    .order("template_sent_at", { ascending: true })
    .limit(effectiveLimit);

  if (error) throw new Error(error.message);

  const template = await getWhatsappFollowUpTemplate();
  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    if (Date.now() + MAX_DELAY_MS > deadline) break;

    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    if (!lead) continue;

    try {
      const text = renderTemplate(template, { name: lead.name, category: lead.category, address: lead.address }).body;
      if (sent > 0) await randomDelay();
      const waMessageId = await sendWhatsappText(row.phone, text);
      const now = new Date().toISOString();

      await supabase
        .from("whatsapp_conversations")
        .update({ followup_sent_at: now, last_outbound_at: now })
        .eq("id", row.id);

      await supabase.from("whatsapp_messages").insert({
        conversation_id: row.id,
        direction: "outbound",
        body: text,
        wa_message_id: waMessageId,
      });

      sent++;
    } catch {
      // Falha no envio - nao marca followup_sent_at, entao e retentado no
      // proximo dia.
      failed++;
    }
  }

  return { sent, failed, total: (rows ?? []).length };
}
