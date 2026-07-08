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
}

export async function getLeadsWithDetails(): Promise<LeadWithDetails[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*, site_analysis(*), outreach(*)")
    .order("created_at", { ascending: false });

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
