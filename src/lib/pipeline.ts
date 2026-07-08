import { supabase } from "./supabase";
import { searchLeads } from "./google-maps";
import { deduplicateLeads } from "./deduplication";
import { analyzeSite } from "./site-analysis";
import { findEmailForWebsite } from "./hunter";

export async function scrapeLeadsForQuery(category: string, location: string) {
  const found = await searchLeads(category, location);
  const deduped = deduplicateLeads(found);

  const { data: existing } = await supabase
    .from("leads")
    .select("name, address")
    .eq("category", category);

  const existingKeys = new Set(
    (existing ?? []).map(
      (l) => `${l.name.trim().toLowerCase()}|${(l.address ?? "").trim().toLowerCase()}`
    )
  );

  const newLeads = deduped.filter(
    (l) =>
      !existingKeys.has(
        `${l.name.trim().toLowerCase()}|${(l.address ?? "").trim().toLowerCase()}`
      )
  );

  if (newLeads.length > 0) {
    const { error } = await supabase.from("leads").insert(newLeads);
    if (error) throw new Error(error.message);
  }

  return {
    found: found.length,
    new_leads: newLeads.length,
    skipped_duplicates: deduped.length - newLeads.length,
  };
}

export async function analyzePendingSites(limit = 50) {
  const { data: analyzed } = await supabase.from("site_analysis").select("lead_id");
  const analyzedIds = new Set((analyzed ?? []).map((a) => a.lead_id));

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, website")
    .limit(limit * 2);

  if (error) throw new Error(error.message);

  const pending = (leads ?? []).filter((l) => !analyzedIds.has(l.id)).slice(0, limit);

  const rows = [];
  for (const lead of pending) {
    const result = await analyzeSite(lead.website ?? undefined);
    rows.push({ lead_id: lead.id, ...result });
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("site_analysis").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  return {
    analyzed: rows.length,
    skipped_already_analyzed: (leads ?? []).length - pending.length,
  };
}

export async function findPendingEmails(limit = 5) {
  const { data: existing } = await supabase.from("outreach").select("lead_id");
  const processedIds = new Set((existing ?? []).map((o) => o.lead_id));

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, website")
    .not("website", "is", null)
    .limit(200);

  if (error) throw new Error(error.message);

  const pending = (leads ?? []).filter((l) => !processedIds.has(l.id)).slice(0, limit);

  const rows = [];
  for (const lead of pending) {
    const result = await findEmailForWebsite(lead.website!);
    rows.push({
      lead_id: lead.id,
      email: result.email,
      email_confidence: result.confidence,
      status: "pending",
    });
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("outreach").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  return {
    processed: rows.length,
    emails_found: rows.filter((r) => r.email).length,
  };
}
