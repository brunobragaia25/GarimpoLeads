import { COUNTRIES, type Country, type Locale } from "./countries";
import {
  buildProblemSummaryFor,
  renderTemplate,
  type MessageTemplate,
  type SiteAnalysisSummary,
} from "./template";

// Montagem do e-mail de outreach num lugar so: o envio real e a tela de
// previa usam exatamente as mesmas funcoes, entao "o que voce ve na previa"
// e "o que sai" nao divergem.

export interface OutreachEmail {
  subject: string;
  body: string;
  blocking: string[];
  warnings: string[];
}

function senderLine(): string {
  const name = process.env.EMAIL_SENDER_NAME || "Bruno Bragaia";
  const company = process.env.EMAIL_SENDER_COMPANY || "DevzDesign";
  const website = process.env.EMAIL_SENDER_WEBSITE || "www.devzdesign.com.br";
  const address = process.env.EMAIL_SENDER_ADDRESS;
  return [name, company, website, address].filter(Boolean).join(" | ");
}

const FOOTER: Record<Locale, { why: string; unsubscribe: string }> = {
  en: {
    why: "You're receiving this because your business is listed publicly on Google Maps.",
    unsubscribe: "If you'd rather not get these emails, click here:",
  },
  "pt-PT": {
    why: "Recebe esta mensagem porque a sua empresa está listada publicamente no Google Maps.",
    unsubscribe: "Se não quiser receber mais estes emails, clique aqui:",
  },
  "pt-BR": {
    why: "Você recebe esta mensagem porque sua empresa está listada publicamente no Google Maps.",
    unsubscribe: "Se não quiser mais receber esses emails, clique aqui:",
  },
};

// Rodape com identificacao clara de quem envia, motivo do contato e o link
// de descadastro (a lei europeia - GDPR/PECR - espera os tres).
export function composeFooter(country: Country, unsubscribeLink: string): string {
  const t = FOOTER[COUNTRIES[country].locale];
  return `---\n${senderLine()}\n${t.why} ${t.unsubscribe} ${unsubscribeLink}`;
}

const TECHNICAL_TEXT = /Request failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|getaddrinfo|status code|\bundefined\b|\bnull\b|\[object|NaN/i;
const ENGLISH_WORDS = /\b(the|and|your|with|website's|we've|please)\b/i;
// \b do JS nao entende letra acentuada ("você" nunca casava) - usa limite Unicode.
const BR_ONLY_WORDS = /(?<![\p{L}])(você|vocês|pra|tá|celular)(?![\p{L}])/iu;

// Checagens de sanidade do texto final. "blocking" impede o envio
// automatico; "warnings" so aparecem na previa.
export function checkEmailQuality(text: string, country: Country, businessName: string): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const locale = COUNTRIES[country].locale;
  // O nome do negocio pode ter qualquer idioma/acento - fora da checagem.
  const plain = businessName ? text.split(businessName).join(" ") : text;

  if (/\{\{|\}\}/.test(text)) blocking.push("variável do template sem preencher");
  if (TECHNICAL_TEXT.test(plain)) blocking.push("texto técnico de erro no meio da mensagem");
  if (locale === "en" && /[ãõç]/i.test(plain)) blocking.push("português no meio de um e-mail em inglês");
  if (locale !== "en" && ENGLISH_WORDS.test(plain.replace(/www\.devzdesign\.com\.br/g, ""))) {
    blocking.push("inglês no meio de um e-mail em português");
  }
  if (locale === "pt-PT" && BR_ONLY_WORDS.test(plain)) warnings.push("palavra do português do Brasil num e-mail de Portugal");
  if (/\b(in|em)\s*[,.]/.test(plain)) warnings.push("cidade ficou vazia na frase");
  return { blocking, warnings };
}

export function buildOutreachEmail(input: {
  template: MessageTemplate;
  country: Country;
  unsubscribeLink: string;
  lead: { name: string; category: string; address: string | null };
  analysis: SiteAnalysisSummary | null;
}): OutreachEmail {
  const { template, country, unsubscribeLink, lead, analysis } = input;
  const rendered = renderTemplate(template, {
    name: lead.name,
    category: lead.category,
    address: lead.address,
    problem: buildProblemSummaryFor(country, analysis),
  });
  const body = `${rendered.body}\n\n${composeFooter(country, unsubscribeLink)}`;
  // A checagem olha o texto sem o link (a URL tem "token" e afins).
  // O nome usado no texto e o cortado no primeiro "|" (ver renderTemplate).
  const shownName = lead.name.split("|")[0].trim() || lead.name.trim();
  const checked = checkEmailQuality(`${rendered.subject}\n${rendered.body}`, country, shownName);
  return { subject: rendered.subject, body, ...checked };
}
