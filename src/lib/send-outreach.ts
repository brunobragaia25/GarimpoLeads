import { supabase } from "./supabase";
import { getTemplate, renderTemplate } from "./template";
import { sendOutreachEmail } from "./resend";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendPendingOutreach(limit = 100, leadId?: string) {
  const template = await getTemplate();

  let query = supabase
    .from("outreach")
    .select("id, lead_id, email, leads(name, category, address)")
    .eq("status", "pending")
    .not("email", "is", null)
    .order("created_at", { ascending: true });

  if (leadId) {
    query = query.eq("lead_id", leadId);
  }

  const { data: rows, error } = await query.limit(limit);

  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    if (!lead || !row.email) continue;

    const rendered = renderTemplate(template, {
      name: lead.name,
      category: lead.category,
      address: lead.address,
    });

    try {
      await sendOutreachEmail(row.email, rendered.subject, rendered.body);
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

  return { sent, failed, total: (rows ?? []).length };
}
