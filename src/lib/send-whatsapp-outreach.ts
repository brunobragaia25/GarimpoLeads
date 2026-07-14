import { supabase } from "./supabase";
import { sendWhatsappTemplate, toWhatsappPhone } from "./whatsapp";
import { isMobilePhone } from "./phone";
import { detectSocialPlatform } from "./social-link";
import { startOfTodayBrasiliaISO } from "./timezone";

const DEFAULT_DAILY_LIMIT = 20;

interface CandidateLead {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  website: string | null;
}

async function countTemplatesSentToday(): Promise<number> {
  const iso = startOfTodayBrasiliaISO();
  const { count } = await supabase
    .from("whatsapp_conversations")
    .select("*", { count: "exact", head: true })
    .gte("template_sent_at", iso);
  return count ?? 0;
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

  const { data: existing, error: existingError } = await supabase
    .from("whatsapp_conversations")
    .select("lead_id");
  if (existingError) throw new Error(existingError.message);
  const existingLeadIds = new Set((existing ?? []).map((c) => c.lead_id));

  // Janela grande + filtro em memoria depois: mesmo padrao ja usado em
  // findPendingEmails/analyzePendingSites pra nao travar nos leads mais
  // antigos quando eles ja tiverem todos conversa iniciada.
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("id, name, category, phone, website")
    .not("phone", "is", null)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (leadsError) throw new Error(leadsError.message);

  const pending = (leads ?? [])
    .filter((l): l is CandidateLead => !existingLeadIds.has(l.id))
    .filter((l) => isMobilePhone(l.phone))
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
