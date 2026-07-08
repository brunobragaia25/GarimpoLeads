import { supabase } from "./supabase";

export interface MessageTemplate {
  subject: string;
  body: string;
}

const DEFAULT_TEMPLATE: MessageTemplate = {
  subject: "Contato - {{empresa}}",
  body: "Olá, tudo bem?\n\nMeu nome é Bruno, sou desenvolvedor e notei o site da {{empresa}} em {{cidade}}...\n\nAbraço.",
};

export async function getTemplate(): Promise<MessageTemplate> {
  const { data } = await supabase
    .from("message_templates")
    .select("subject, body")
    .limit(1)
    .maybeSingle();

  return data ?? DEFAULT_TEMPLATE;
}

export async function saveTemplate(subject: string, body: string): Promise<void> {
  const { data: existing } = await supabase
    .from("message_templates")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("message_templates")
      .update({ subject, body, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("message_templates").insert({ subject, body });
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
