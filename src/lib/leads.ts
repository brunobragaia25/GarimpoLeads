import { supabase } from "./supabase";

export interface LeadWithDetails {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  google_maps_url: string | null;
  created_at: string;
  has_website: boolean | null;
  is_wordpress: boolean | null;
  performance_score: number | null;
  is_outdated: boolean | null;
  is_slow: boolean | null;
  email: string | null;
  email_confidence: number | null;
  outreach_status: string | null;
  contacted_at: string | null;
  follow_up_sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
}

// Teto de segurança pra não puxar uma tabela ilimitada de uma vez; o cron
// adiciona algumas centenas de leads por semana, então isso cobre meses.
const MAX_LEADS = 5000;

export async function getLeadsWithDetails(): Promise<LeadWithDetails[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*, site_analysis(*), outreach(*)")
    .order("created_at", { ascending: false })
    .limit(MAX_LEADS);

  if (error) throw new Error(error.message);

  return (data ?? []).map((lead) => {
    const analysis = Array.isArray(lead.site_analysis) ? lead.site_analysis[0] : null;
    const outreach = Array.isArray(lead.outreach) ? lead.outreach[0] : null;

    return {
      id: lead.id,
      name: lead.name,
      category: lead.category,
      phone: lead.phone,
      address: lead.address,
      website: lead.website,
      google_maps_url: lead.google_maps_url,
      created_at: lead.created_at,
      has_website: analysis?.has_website ?? null,
      is_wordpress: analysis?.is_wordpress ?? null,
      performance_score: analysis?.performance_score ?? null,
      is_outdated: analysis?.is_outdated ?? null,
      is_slow: analysis?.is_slow ?? null,
      email: outreach?.email ?? null,
      email_confidence: outreach?.email_confidence ?? null,
      outreach_status: outreach?.status ?? null,
      contacted_at: outreach?.contacted_at ?? null,
      follow_up_sent_at: outreach?.follow_up_sent_at ?? null,
      opened_at: outreach?.opened_at ?? null,
      clicked_at: outreach?.clicked_at ?? null,
    };
  });
}

export function isPriorityProspect(lead: LeadWithDetails): boolean {
  return (
    lead.has_website === false ||
    lead.is_wordpress === true ||
    lead.is_slow === true ||
    lead.is_outdated === true
  );
}

// Pontuação heurística de "quão provável é fechar negócio": sem site é o
// sinal mais forte (nem tem presença online), seguido de site lento/antigo.
export function computeLeadScore(lead: LeadWithDetails): number {
  let score = 0;
  if (lead.has_website === false) score += 100;
  if (lead.is_wordpress) score += 30;
  if (lead.is_slow) score += 30;
  if (lead.is_outdated) score += 20;
  if (lead.performance_score !== null) {
    score += Math.max(0, 100 - lead.performance_score) * 0.2;
  }
  return Math.round(score);
}

export type EmailFilter =
  | "all"
  | "no_email"
  | "pending"
  | "contacted"
  | "ignored"
  | "unsubscribed"
  | "bounced"
  | "responded"
  | "meeting_scheduled"
  | "proposal_sent"
  | "closed_won"
  | "closed_lost";

export function matchesEmailFilter(lead: LeadWithDetails, filter: EmailFilter): boolean {
  if (filter === "all") return true;
  if (filter === "no_email") return !lead.email;
  if (filter === "pending") return !!lead.email && lead.outreach_status === "pending";
  return lead.outreach_status === filter;
}
