import { supabase } from "./supabase";

export interface MessageTemplate {
  subject: string;
  body: string;
}

export interface StoredTemplate extends MessageTemplate {
  id: string;
  category: string | null;
}

const DEFAULT_TEMPLATE: MessageTemplate = {
  subject: "Sobre o site da {{empresa}}",
  body: "Oi, tudo bem?\n\nSou o Bruno, da DevzDesign (devzdesign.com.br) - trabalho com modernização de sites.\n\nDei uma olhada no site da {{empresa}} e reparei que {{problema}}. Isso pode estar afastando quem pesquisa por {{categoria}} em {{cidade}} e acaba indo pro concorrente.\n\nSe fizer sentido, posso te mostrar rapidinho o que notei, sem compromisso.\n\nAbraço,\nBruno Bragaia\nDevzDesign",
};

export const FOLLOWUP_CATEGORY = "__followup__";

const DEFAULT_FOLLOWUP_TEMPLATE: MessageTemplate = {
  subject: "Re: sobre o site da {{empresa}}",
  body: "Oi, tudo bem?\n\nPassando só pra saber se você chegou a ver meu email anterior sobre o site da {{empresa}}. Fico à disposição se quiser trocar uma ideia.\n\nAbraço,\nBruno",
};

export async function getFollowUpTemplate(): Promise<MessageTemplate> {
  const { data } = await supabase
    .from("message_templates")
    .select("subject, body")
    .eq("category", FOLLOWUP_CATEGORY)
    .maybeSingle();

  return data ?? DEFAULT_FOLLOWUP_TEMPLATE;
}

// Mensagem que abre pré-preenchida no botão de WhatsApp dos leads sem site
// (não usa "subject", só o corpo mesmo).
export const WHATSAPP_NO_SITE_CATEGORY = "__whatsapp_no_site__";

const DEFAULT_WHATSAPP_NO_SITE_TEMPLATE: MessageTemplate = {
  subject: "",
  body: "Oi! Tudo bem? Meu nome é Bruno, da DevzDesign 🙂 Vi que a {{empresa}} ainda não tem site, e isso pode estar fazendo vocês perderem clientes que buscam por aí no Google. Posso te mostrar rapidinho como resolveríamos isso, sem compromisso?",
};

export async function getWhatsappNoSiteTemplate(): Promise<MessageTemplate> {
  const { data } = await supabase
    .from("message_templates")
    .select("subject, body")
    .eq("category", WHATSAPP_NO_SITE_CATEGORY)
    .maybeSingle();

  return data ?? DEFAULT_WHATSAPP_NO_SITE_TEMPLATE;
}

export async function listTemplates(): Promise<StoredTemplate[]> {
  const { data } = await supabase
    .from("message_templates")
    .select("id, category, subject, body")
    .order("category", { ascending: true, nullsFirst: true });

  return data ?? [];
}

export async function getTemplate(category?: string | null): Promise<MessageTemplate> {
  if (category) {
    const { data: specific } = await supabase
      .from("message_templates")
      .select("subject, body")
      .eq("category", category)
      .maybeSingle();
    if (specific) return specific;
  }

  const { data: fallback } = await supabase
    .from("message_templates")
    .select("subject, body")
    .is("category", null)
    .maybeSingle();

  return fallback ?? DEFAULT_TEMPLATE;
}

async function findTemplateId(category: string | null): Promise<string | null> {
  const query = supabase.from("message_templates").select("id");
  const { data } = category
    ? await query.eq("category", category).maybeSingle()
    : await query.is("category", null).maybeSingle();
  return data?.id ?? null;
}

export async function saveTemplate(
  subject: string,
  body: string,
  category: string | null
): Promise<void> {
  const existingId = await findTemplateId(category);

  if (existingId) {
    const { error } = await supabase
      .from("message_templates")
      .update({ subject, body, updated_at: new Date().toISOString() })
      .eq("id", existingId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("message_templates").insert({ subject, body, category });
    if (error) throw new Error(error.message);
  }
}

function extractCity(address: string | null): string {
  if (!address) return "";
  const match = address.match(/,\s*([^,]+?)\s*-\s*[A-Z]{2},/);
  return match ? match[1].trim() : "";
}

export interface SiteAnalysisSummary {
  performance_score: number | null;
  is_slow: boolean | null;
  is_outdated: boolean | null;
  is_wordpress: boolean | null;
  is_broken?: boolean | null;
  broken_reason?: string | null;
  notes?: string | null;
}

function extractLoadSeconds(notes: string | null | undefined): string | null {
  const match = notes?.match(/Carregou em (\d+)ms/);
  if (!match) return null;
  return (Number(match[1]) / 1000).toFixed(1).replace(".", ",");
}

// Converte os achados reais da análise do site (site_analysis) numa frase
// natural em português, pra email deixar de soar genérico ("coisas como
// velocidade, visual...") e citar algo específico e verdadeiro sobre o
// site do lead. Sem análise ou sem nenhum problema detectado, cai pra uma
// frase neutra em vez de deixar {{problema}} vazio no meio do texto.
export function buildProblemSummary(analysis: SiteAnalysisSummary | null): string {
  if (!analysis) return "tem alguns pontos que dava pra melhorar";

  // Site fora do ar (hospedagem vencida, domínio estacionado, apontamento
  // errado) é o achado mais forte possível - sobrepõe qualquer outro ponto,
  // porque nesse caso nem faz sentido falar de performance/visual.
  if (analysis.is_broken) {
    return analysis.broken_reason
      ? `o site nem está no ar - parece ${analysis.broken_reason}`
      : "o site nem está no ar";
  }

  const parts: string[] = [];
  if (analysis.is_slow || (analysis.performance_score !== null && analysis.performance_score < 50)) {
    const seconds = extractLoadSeconds(analysis.notes);
    if (seconds && analysis.performance_score !== null) {
      parts.push(
        `o site demora ${seconds} segundos pra carregar (nota de performance é só ${analysis.performance_score} de 100)`
      );
    } else if (seconds) {
      parts.push(`o site demora ${seconds} segundos pra carregar`);
    } else if (analysis.performance_score !== null) {
      parts.push(`o site tem nota de performance baixa (${analysis.performance_score} de 100)`);
    } else {
      parts.push("o carregamento tá bem lento");
    }
  }
  if (analysis.is_outdated) {
    parts.push("o visual parece desatualizado");
  }
  if (analysis.is_wordpress) {
    parts.push("é feito em WordPress, o que costuma pesar mais e abrir brechas de segurança");
  }

  if (parts.length === 0) return "tem alguns pontos que dava pra melhorar";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

export interface TemplateLeadData {
  name: string;
  category: string;
  address: string | null;
  problem?: string;
}

export function renderTemplate(template: MessageTemplate, lead: TemplateLeadData): MessageTemplate {
  const vars: Record<string, string> = {
    empresa: lead.name,
    categoria: lead.category,
    cidade: extractCity(lead.address),
    problema: lead.problem ?? "tem alguns pontos que dava pra melhorar",
  };

  function render(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
  }

  return {
    subject: render(template.subject),
    body: render(template.body),
  };
}
