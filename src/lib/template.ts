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
  subject: "Contato - {{empresa}}",
  body: "Olá, tudo bem?\n\nMeu nome é Bruno, sou desenvolvedor e notei o site da {{empresa}} em {{cidade}}...\n\nAbraço.",
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

export interface TemplateLeadData {
  name: string;
  category: string;
  address: string | null;
}

export function renderTemplate(template: MessageTemplate, lead: TemplateLeadData): MessageTemplate {
  const vars: Record<string, string> = {
    empresa: lead.name,
    categoria: lead.category,
    cidade: extractCity(lead.address),
  };

  function render(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
  }

  return {
    subject: render(template.subject),
    body: render(template.body),
  };
}
