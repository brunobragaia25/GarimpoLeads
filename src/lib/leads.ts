import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";
import type { SocialPlatform } from "./social-link";
import { COUNTRY_CODES, isCountry, parseCountry, type Country } from "./countries";

export function toBrasiliaDateStr(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export interface LeadWithDetails {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  google_maps_url: string | null;
  country: Country;
  created_at: string;
  has_website: boolean | null;
  is_wordpress: boolean | null;
  performance_score: number | null;
  is_outdated: boolean | null;
  is_slow: boolean | null;
  is_broken: boolean | null;
  broken_reason: string | null;
  site_notes: string | null;
  email: string | null;
  email_confidence: number | null;
  outreach_status: string | null;
  contacted_at: string | null;
  follow_up_sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  crm_synced_at: string | null;
  social_platform: SocialPlatform | null;
  whatsapp_template_sent_at: string | null;
  whatsapp_followup_sent_at: string | null;
  ps_mobile_score: number | null;
  ps_lcp_ms: number | null;
  replied_at: string | null;
  reply_snippet: string | null;
}

// Lista vem da view lead_overview (supabase/lead_overview.sql): lead + ultima
// analise + outreach + WhatsApp + campos calculados (score, prioritario,
// rede social). Filtro, ordenacao, paginacao e contagem rodam no banco -
// antes o app baixava todos os leads a cada acesso e filtrava em memoria.
const OVERVIEW_COLUMNS = [
  "id, name, category, phone, address, website, google_maps_url, country, created_at, crm_synced_at",
  "has_website, is_wordpress, performance_score, is_outdated, is_slow, is_broken, broken_reason, site_notes",
  "email, email_confidence, outreach_status, contacted_at, follow_up_sent_at, opened_at, clicked_at",
  "whatsapp_template_sent_at, whatsapp_followup_sent_at, social_platform",
  "ps_mobile_score, ps_lcp_ms, replied_at, reply_snippet",
].join(", ");

// PostgREST corta qualquer resposta em 1000 linhas (config "Max Rows").
const POSTGREST_PAGE_SIZE = 1000;

export type LeadSortField = "created_at" | "score" | "name" | "category" | "performance" | "phone";

export interface LeadQuery {
  country: Country;
  category?: string;
  status?: EmailFilter;
  search?: string;
  priorityOnly?: boolean;
  site?: "with" | "without" | "broken" | "";
  sentDate?: string;
  // Filtros usados pelas filas
  hasEmail?: boolean;
  usablePhoneOnly?: boolean;
  excludeSocial?: boolean;
  noSiteFirst?: boolean;
  sortField?: LeadSortField;
  sortDir?: "asc" | "desc";
}

const SORT_COLUMN: Record<LeadSortField, string> = {
  created_at: "created_at",
  score: "score",
  name: "name",
  category: "category",
  performance: "performance_score",
  phone: "is_mobile",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyLeadQuery(query: any, q: LeadQuery) {
  query = query.eq("country", q.country);
  if (q.category) query = query.eq("category", q.category);

  switch (q.status ?? "all") {
    case "all":
      break;
    case "no_email":
      query = query.is("email", null);
      break;
    case "not_contacted":
      query = query.or("outreach_status.is.null,outreach_status.eq.pending");
      break;
    case "pending":
      query = query.not("email", "is", null).eq("outreach_status", "pending");
      break;
    default:
      query = query.eq("outreach_status", q.status);
  }

  if (q.search) {
    // Escapa os curingas do ILIKE pra busca ser literal.
    const term = q.search.replace(/[\\%_]/g, (c) => `\\${c}`);
    query = query.ilike("name", `%${term}%`);
  }
  if (q.priorityOnly) query = query.eq("is_priority", true);
  if (q.site === "with") query = query.not("website", "is", null);
  if (q.site === "without") query = query.is("website", null);
  if (q.site === "broken") query = query.eq("is_broken", true);
  if (q.sentDate && /^\d{4}-\d{2}-\d{2}$/.test(q.sentDate)) {
    query = query.or(`contacted_date.eq.${q.sentDate},follow_up_date.eq.${q.sentDate}`);
  }
  if (q.hasEmail === true) query = query.not("email", "is", null);
  if (q.hasEmail === false) query = query.is("email", null);
  if (q.usablePhoneOnly) query = query.eq("has_usable_phone", true);
  if (q.excludeSocial) query = query.is("social_platform", null);

  const ascending = q.sortDir === "asc";
  if (q.noSiteFirst) query = query.order("has_site", { ascending: true });
  const sortField = q.sortField ?? "created_at";
  // Nota de performance nula conta como a menor possivel (mesmo que antes).
  const nullsFirst = sortField === "performance" ? ascending : undefined;
  query = query.order(SORT_COLUMN[sortField], { ascending, nullsFirst });
  // Desempate estavel, senao a paginacao pode repetir/perder lead.
  return query.order("id", { ascending: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLead(row: any): LeadWithDetails {
  return { ...row, country: parseCountry(row.country) } as LeadWithDetails;
}

export async function countLeads(q: LeadQuery): Promise<number> {
  const { count, error } = await applyLeadQuery(
    supabase.from("lead_overview").select("id", { count: "exact", head: true }),
    { ...q, sortField: undefined, noSiteFirst: false }
  );
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function queryLeads(q: LeadQuery, offset: number, limit: number): Promise<LeadWithDetails[]> {
  if (limit <= 0) return [];
  const { data, error } = await applyLeadQuery(supabase.from("lead_overview").select(OVERVIEW_COLUMNS), q).range(
    offset,
    offset + limit - 1
  );
  // Offset alem do fim (pagina que nao existe mais): PostgREST devolve erro
  // em vez de lista vazia.
  if (error?.code === "PGRST103") return [];
  if (error) throw new Error(error.message);
  return (data ?? []).map(toLead);
}

// Todos os leads que batem no filtro (export CSV) - paginas em paralelo.
export async function queryAllLeads(q: LeadQuery): Promise<LeadWithDetails[]> {
  const total = await countLeads(q);
  const offsets: number[] = [];
  for (let offset = 0; offset < total; offset += POSTGREST_PAGE_SIZE) offsets.push(offset);
  const pages = await Promise.all(offsets.map((offset) => queryLeads(q, offset, POSTGREST_PAGE_SIZE)));
  return pages.flat();
}

export interface LeadStats {
  total: number;
  prospects: number;
  with_email: number;
  pending_to_send: number;
  not_contacted: number;
  email_contacted: number;
  whatsapp_contacted: number;
  email_queue_pending: number;
}

const EMPTY_STATS: LeadStats = {
  total: 0,
  prospects: 0,
  with_email: 0,
  pending_to_send: 0,
  not_contacted: 0,
  email_contacted: 0,
  whatsapp_contacted: 0,
  email_queue_pending: 0,
};

async function fetchLeadStats(): Promise<Record<Country, LeadStats>> {
  const { data, error } = await supabase.from("lead_stats").select("*");
  if (error) throw new Error(error.message);
  const result = Object.fromEntries(COUNTRY_CODES.map((c) => [c, { ...EMPTY_STATS }])) as Record<Country, LeadStats>;
  for (const row of data ?? []) {
    const country: unknown = row.country;
    if (isCountry(country)) result[country] = row;
  }
  return result;
}

async function fetchLeadCategories(country: Country): Promise<string[]> {
  const { data, error } = await supabase
    .from("lead_category_counts")
    .select("category")
    .eq("country", country);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.category as string).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Lead cujo "site" é na real só um link de Instagram/Facebook/WhatsApp/
// Linktree é, na prática, um prospect sem site de verdade - por isso conta
// como prioritário igual a quem não tem nada preenchido.
export function isPriorityProspect(lead: LeadWithDetails): boolean {
  return (
    lead.has_website === false ||
    lead.social_platform !== null ||
    lead.is_broken === true ||
    lead.is_wordpress === true ||
    lead.is_slow === true ||
    lead.is_outdated === true
  );
}

// Pontuação heurística de "quão provável é fechar negócio": sem site é o
// sinal mais forte (nem tem presença online), seguido de site lento/antigo.
// Link de rede social conta quase como não ter site (ainda precisa de um
// site de verdade), mas um pouco menos porque já tem alguma presença online.
export function computeLeadScore(lead: LeadWithDetails): number {
  let score = 0;
  if (lead.has_website === false) score += 100;
  if (lead.is_broken) score += 90;
  if (lead.social_platform !== null) score += 80;
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
  | "not_contacted"
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

// Numeros dos cards e lista de categorias mudam devagar e sao os calculos
// mais caros (varrem a base inteira) - em cache por 60s, pra trocar de
// pagina/filtro nao recalcular tudo. Podem ficar ate 1 min desatualizados.
const STATS_CACHE_SECONDS = 60;

export const getLeadStats = unstable_cache(fetchLeadStats, ["lead-stats"], {
  revalidate: STATS_CACHE_SECONDS,
});

export const getLeadCategories = unstable_cache(fetchLeadCategories, ["lead-categories"], {
  revalidate: STATS_CACHE_SECONDS,
});
