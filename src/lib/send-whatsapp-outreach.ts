import { supabase } from "./supabase";
import { sendWhatsappTemplate, toWhatsappPhone } from "./whatsapp";
import { hasUsablePhone } from "./phone";
import { detectSocialPlatform } from "./social-link";
import { startOfTodayBrasiliaISO } from "./timezone";

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

// Dispara o template Meta aprovado (categoria "marketing", pago por envio)
// pra leads elegiveis com WhatsApp que ainda nao tem conversa iniciada.
// Espelha a estrutura de sendPendingOutreach em send-outreach.ts, mas pro
// canal WhatsApp em vez de email.
export async function sendPendingWhatsappTemplates(limit = 20) {
  const dailyLimit = Number(process.env.WHATSAPP_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const alreadySentToday = await countTemplatesSentToday();
  const remainingToday = Math.max(0, dailyLimit - alreadySentToday);
  const effectiveLimit = Math.min(limit, remainingToday);

  if (effectiveLimit === 0) {
    return { sent: 0, failed: 0, total: 0, daily_limit_reached: true, sent_today: alreadySentToday, daily_limit: dailyLimit };
  }

  const existingLeadIds = new Set(await fetchAllColumn("whatsapp_conversations", "lead_id"));

  // Janela grande + filtro em memoria depois: mesmo padrao ja usado em
  // findPendingEmails/analyzePendingSites pra nao travar nos leads mais
  // antigos quando eles ja tiverem todos conversa iniciada.
  const leads: CandidateLead[] = [];
  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    const { data, error: leadsError } = await supabase
      .from("leads")
      .select("id, name, category, phone, website")
      .not("phone", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1);
    if (leadsError) throw new Error(leadsError.message);
    if (!data || data.length === 0) break;

    leads.push(...data);
    if (data.length < POSTGREST_PAGE_SIZE) break;
  }

  const pending = leads
    .filter((l): l is CandidateLead => !existingLeadIds.has(l.id))
    .filter((l) => hasUsablePhone(l.phone))
    .filter((l) => detectSocialPlatform(l.website) === null)
    .slice(0, effectiveLimit);

  let sent = 0;
  let failed = 0;

  for (const lead of pending) {
    const hasWebsite = !!lead.website;
    const templateName = hasWebsite
      ? process.env.WHATSAPP_TEMPLATE_HAS_SITE_NAME!
      : process.env.WHATSAPP_TEMPLATE_NO_SITE_NAME!;
    const variables = hasWebsite ? [lead.name, lead.category] : [lead.name];

    try {
      const waMessageId = await sendWhatsappTemplate(lead.phone!, templateName, variables);
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

      // Registra o envio do template no historico - o conteudo exato do
      // template fica so no lado da Meta (aprovado la, nao renderizado
      // aqui), entao gravamos uma nota legivel em vez do texto literal.
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        direction: "outbound",
        body: `[Template "${templateName}" enviado com variáveis: ${variables.join(", ")}]`,
        wa_message_id: waMessageId,
      });

      sent++;
    } catch {
      // Falha no envio (numero invalido, template rejeitado, etc.) - nao
      // grava conversa, entao o lead e retentado no proximo dia.
      failed++;
    }
  }

  return {
    sent,
    failed,
    total: pending.length,
    daily_limit_reached: false,
    sent_today: alreadySentToday + sent,
    daily_limit: dailyLimit,
  };
}

// Follow-up pra quem recebeu o template inicial ha X dias e nunca respondeu
// nada (last_inbound_at continua null) - reabre a janela de 24h com outro
// template pago, ja que texto livre so funciona depois que o lead responde.
export async function sendPendingWhatsappFollowUps(daysThreshold = 5, limit = 20) {
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
    .select("id, phone, lead_id, leads(name)")
    .is("last_inbound_at", null)
    .is("followup_sent_at", null)
    .lte("template_sent_at", cutoff.toISOString())
    .order("template_sent_at", { ascending: true })
    .limit(effectiveLimit);

  if (error) throw new Error(error.message);

  const templateName = process.env.WHATSAPP_TEMPLATE_FOLLOWUP_NAME!;
  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    if (!lead) continue;

    try {
      const waMessageId = await sendWhatsappTemplate(row.phone, templateName, [lead.name]);
      const now = new Date().toISOString();

      await supabase
        .from("whatsapp_conversations")
        .update({ followup_sent_at: now, last_outbound_at: now })
        .eq("id", row.id);

      await supabase.from("whatsapp_messages").insert({
        conversation_id: row.id,
        direction: "outbound",
        body: `[Template "${templateName}" enviado com variáveis: ${lead.name}]`,
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
