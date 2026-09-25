import { supabase } from "./supabase";
import { COUNTRIES, isCountry, type Country, type Locale } from "./countries";
export { categoryTemplateKey } from "./countries";

export interface MessageTemplate {
  subject: string;
  body: string;
}

export interface StoredTemplate extends MessageTemplate {
  id: string;
  category: string | null;
}

// Textos padrao usados quando nao ha versao salva no banco (editaveis em
// /template). Chaves = message_templates.category (ver countries.ts).
const DEFAULT_TEMPLATES: Record<string, MessageTemplate> = {
  // ---- Brasil
  "": {
    subject: "Uma nova versão do site da {{empresa}}",
    body: "Olá! Eu me chamo Bruno e sou da DevzDesign (www.devzdesign.com.br), nós trabalhamos com desenvolvimento de websites.\n\nDei uma olhada no site da {{empresa}} e reparei que {{problema}}. Isso pode estar afastando quem pesquisa por {{categoria}} em {{cidade}}.\n\nNós desenvolvemos uma nova versão do site da sua empresa e queríamos saber se você está interessado em pelo menos ver, o preço falamos em um segundo momento.\n\nO que acha?\n\nAbraço,\nBruno Bragaia\nDevzDesign",
  },
  __whatsapp_no_site__: {
    subject: "",
    body: "Olá! Eu me chamo Bruno e sou da DevzDesign (www.devzdesign.com.br), nós trabalhamos com desenvolvimento de websites e estamos prospectando empresas que são bem avaliadas no google e que não possuem website que é um canal importante para captação de novos clientes.\n\nNós desenvolvemos um website para a sua empresa e queríamos saber se você está interessado em pelo menos ver, o preço falamos em um segundo momento.\n\nO que acha?",
  },
  __followup__: {
    subject: "Re: sobre o site da {{empresa}}",
    body: "Oi, tudo bem?\n\nPassando só pra saber se você chegou a ver meu email anterior sobre o site da {{empresa}}. Fico à disposição se quiser trocar uma ideia.\n\nAbraço,\nBruno",
  },
  // ---- EUA
  __default_us__: {
    subject: "A new version of {{empresa}}'s website",
    body: "Hi! My name is Bruno, I'm with DevzDesign (www.devzdesign.com.br). We build websites.\n\nI took a look at {{empresa}}'s website and noticed that {{problema}}. That could be turning away people searching for {{categoria}} in {{cidade}}.\n\nWe've built a new version of your website and wanted to know if you'd be interested in at least taking a look. We can talk about pricing at a later stage.\n\nWhat do you think?\n\nBest,\nBruno",
  },
  __no_site_us__: {
    subject: "A website for {{empresa}}",
    body: "Hi! My name is Bruno, I'm with DevzDesign (www.devzdesign.com.br). We build websites, and we're reaching out to businesses that are well rated on Google but don't have a website yet - which is an important channel for getting new customers.\n\nWe've built a website for your business and wanted to know if you'd be interested in at least taking a look. We can talk about pricing at a later stage.\n\nWhat do you think?",
  },
  __followup_us__: {
    subject: "Re: about {{empresa}}'s website",
    body: "Hi again,\n\nJust checking if you had a chance to see my previous email about {{empresa}}'s website. Happy to chat if you're interested.\n\nBest,\nBruno",
  },
  // ---- Portugal (portugues europeu)
  __default_pt__: {
    subject: "Uma nova versão do site da {{empresa}}",
    body: "Olá! Chamo-me Bruno e sou da DevzDesign (www.devzdesign.com.br). Trabalhamos com desenvolvimento de websites.\n\nEstive a ver o site da {{empresa}} e reparei que {{problema}}. Isso pode estar a afastar quem procura {{categoria}} em {{cidade}}.\n\nDesenvolvemos uma nova versão do site da vossa empresa e gostaríamos de saber se têm interesse em, pelo menos, vê-la. O preço falamos num segundo momento.\n\nO que acham?\n\nCumprimentos,\nBruno Bragaia\nDevzDesign",
  },
  __no_site_pt__: {
    subject: "Um website para a {{empresa}}",
    body: "Olá! Chamo-me Bruno e sou da DevzDesign (www.devzdesign.com.br). Trabalhamos com desenvolvimento de websites e estamos a contactar empresas bem avaliadas no Google que ainda não têm website, que é um canal importante para captar novos clientes.\n\nDesenvolvemos um website para a vossa empresa e gostaríamos de saber se têm interesse em, pelo menos, vê-lo. O preço falamos num segundo momento.\n\nO que acham?",
  },
  __followup_pt__: {
    subject: "Re: sobre o site da {{empresa}}",
    body: "Olá,\n\nSó queria saber se chegaram a ver o meu email anterior sobre o site da {{empresa}}. Fico à disposição se quiserem conversar.\n\nCumprimentos,\nBruno",
  },
  // ---- Reino Unido
  __default_uk__: {
    subject: "A new version of {{empresa}}'s website",
    body: "Hi! My name is Bruno, I'm with DevzDesign (www.devzdesign.com.br). We build websites.\n\nI had a look at {{empresa}}'s website and noticed that {{problema}}. That could be putting off people searching for {{categoria}} in {{cidade}}.\n\nWe've built a new version of your website and wanted to know if you'd be interested in at least having a look. We can talk about pricing at a later stage.\n\nWhat do you think?\n\nKind regards,\nBruno",
  },
  __no_site_uk__: {
    subject: "A website for {{empresa}}",
    body: "Hi! My name is Bruno, I'm with DevzDesign (www.devzdesign.com.br). We build websites, and we're getting in touch with businesses that are well rated on Google but don't have a website yet - which is an important channel for winning new customers.\n\nWe've built a website for your business and wanted to know if you'd be interested in at least having a look. We can talk about pricing at a later stage.\n\nWhat do you think?",
  },
  __followup_uk__: {
    subject: "Re: about {{empresa}}'s website",
    body: "Hi again,\n\nJust checking whether you had a chance to see my previous email about {{empresa}}'s website. Happy to have a chat if you're interested.\n\nKind regards,\nBruno",
  },
};

// Chaves antigas continuam exportadas (usadas pela tela /template).
export const FOLLOWUP_CATEGORY = COUNTRIES.BR.templateKeys.followUp;
export const WHATSAPP_NO_SITE_CATEGORY = COUNTRIES.BR.templateKeys.noSite;

async function getStoredTemplate(key: string | null): Promise<MessageTemplate | null> {
  const query = supabase.from("message_templates").select("subject, body");
  const { data } = key ? await query.eq("category", key).maybeSingle() : await query.is("category", null).maybeSingle();
  return data ?? null;
}

async function getSpecialTemplate(key: string | null): Promise<MessageTemplate> {
  return (await getStoredTemplate(key)) ?? DEFAULT_TEMPLATES[key ?? ""];
}

export async function getFollowUpTemplate(country: Country = "BR"): Promise<MessageTemplate> {
  return getSpecialTemplate(COUNTRIES[country].templateKeys.followUp);
}

// Mensagem pros leads sem site (WhatsApp e fila de email).
export async function getWhatsappNoSiteTemplate(country: Country = "BR"): Promise<MessageTemplate> {
  return getSpecialTemplate(COUNTRIES[country].templateKeys.noSite);
}

export async function listTemplates(): Promise<StoredTemplate[]> {
  const { data } = await supabase
    .from("message_templates")
    .select("id, category, subject, body")
    .order("category", { ascending: true, nullsFirst: true });

  return data ?? [];
}

// Template de uma categoria; sem template proprio, cai no padrao do pais.
// Chave especial (ex: "__no_site_pt__") sem versao salva devolve o texto
// padrao dela, nao o de outro pais. Chave com prefixo ("PT:dentistas")
// define o pais do fallback.
export async function getTemplate(category?: string | null, country: Country = "BR"): Promise<MessageTemplate> {
  const prefix = category?.match(/^([A-Z]{2}):/)?.[1];
  if (isCountry(prefix)) country = prefix;
  if (category) {
    const specific = await getStoredTemplate(category);
    if (specific) return specific;
    if (DEFAULT_TEMPLATES[category]) return DEFAULT_TEMPLATES[category];
  }
  return getSpecialTemplate(COUNTRIES[country].templateKeys.default);
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

export function extractCity(address: string | null): string {
  if (!address) return "";
  // Formato BR: "Rua X, Cidade - UF, CEP". Formato EUA (Google Places em
  // inglês): "Street, City, ST ZIP[, USA]" - sem traço antes da sigla do
  // estado, então precisa de um padrão à parte.
  const brMatch = address.match(/,\s*([^,]+?)\s*-\s*[A-Z]{2},/);
  if (brMatch) return brMatch[1].trim();
  const usMatch = address.match(/,\s*([^,]+?),\s*[A-Z]{2}\s+\d{5}/);
  if (usMatch) return usMatch[1].trim();
  // Portugal: "Rua X, 1100-053 Lisboa, Portugal" (cidade depois do codigo postal).
  const ptMatch = address.match(/\b\d{4}-\d{3}\s+([^,]+)/);
  if (ptMatch) return ptMatch[1].trim();
  // Reino Unido: "10 High St, Manchester M1 1AA, UK" (cidade antes do postcode).
  const ukMatch = address.match(/,\s*([^,]+?)\s+[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/);
  if (ukMatch) return ukMatch[1].trim();
  return "";
}

export interface SiteAnalysisSummary {
  performance_score: number | null;
  is_slow: boolean | null;
  is_outdated: boolean | null;
  is_wordpress: boolean | null;
  is_broken?: boolean | null;
  broken_reason?: string | null;
  notes?: string | null;
  // PageSpeed Insights (Lighthouse no celular) - achado real de velocidade.
  ps_mobile_score?: number | null;
  ps_lcp_ms?: number | null;
}

function extractLoadSeconds(notes: string | null | undefined, locale: Locale): string | null {
  const match = notes?.match(/Carregou em (\d+)ms/);
  if (!match) return null;
  const formatted = (Number(match[1]) / 1000).toFixed(1);
  return locale === "en" ? formatted : formatted.replace(".", ",");
}

// Frases por idioma. pt-PT separado do pt-BR ("a carregar", "há"), senao o
// texto brasileiro ("pra", "tá") soa estranho em Portugal.
const PROBLEM_PHRASES: Record<
  Locale,
  {
    fallback: string;
    and: string;
    slowWithScore: (s: string, score: number) => string;
    slow: (s: string) => string;
    lowScore: (score: number) => string;
    slowGeneric: string;
    pageSpeed: (score: number, lcpSeconds: string) => string;
    outdated: string;
    wordpress: string;
    offline: string;
    certificate: string;
    hostingSuspended: string;
    hostingExpired: string;
    domainExpired: string;
    parked: string;
    defaultPage: string;
  }
> = {
  "pt-BR": {
    fallback: "tem alguns pontos que dava pra melhorar",
    and: "e",
    slowWithScore: (s, n) => `o site demora ${s} segundos pra carregar (nota de performance é só ${n} de 100)`,
    slow: (s) => `o site demora ${s} segundos pra carregar`,
    lowScore: (n) => `o site tem nota de performance baixa (${n} de 100)`,
    slowGeneric: "o carregamento tá bem lento",
    pageSpeed: (n, s) => `no celular, o Google dá nota ${n} de 100 pra velocidade do site e o conteúdo principal leva ${s} segundos pra aparecer`,
    outdated: "o visual parece desatualizado",
    wordpress: "é feito em WordPress, o que costuma pesar mais e abrir brechas de segurança",
    offline: "o site nem está no ar",
    certificate: "o navegador mostra um aviso de segurança ao abrir o site (certificado com problema)",
    hostingSuspended: "o site nem está no ar - parece hospedagem suspensa",
    hostingExpired: "o site nem está no ar - parece hospedagem vencida",
    domainExpired: "o site nem está no ar - parece domínio expirado",
    parked: "o domínio do site está estacionado/à venda",
    defaultPage: "o site nem está no ar - só aparece uma página padrão do servidor",
  },
  "pt-PT": {
    fallback: "há alguns pontos que podiam ser melhorados",
    and: "e",
    slowWithScore: (s, n) => `o site demora ${s} segundos a carregar (a nota de desempenho é só ${n} em 100)`,
    slow: (s) => `o site demora ${s} segundos a carregar`,
    lowScore: (n) => `o site tem uma nota de desempenho baixa (${n} em 100)`,
    slowGeneric: "o site está a carregar muito devagar",
    pageSpeed: (n, s) => `no telemóvel, o Google atribui ao site uma nota de ${n} em 100 em velocidade e o conteúdo principal demora ${s} segundos a aparecer`,
    outdated: "o design parece desatualizado",
    wordpress: "foi feito em WordPress, o que costuma torná-lo mais pesado e mais exposto a falhas de segurança",
    offline: "o site não está no ar",
    certificate: "o navegador mostra um aviso de segurança ao abrir o site (problema no certificado)",
    hostingSuspended: "o site não está no ar - parece que o alojamento foi suspenso",
    hostingExpired: "o site não está no ar - parece que o alojamento expirou",
    domainExpired: "o site não está no ar - parece que o domínio expirou",
    parked: "o domínio do site parece estar à venda",
    defaultPage: "o site não está no ar - só aparece uma página padrão do servidor",
  },
  en: {
    fallback: "there are a few things that could be improved",
    and: "and",
    slowWithScore: (s, n) => `the site takes ${s} seconds to load (performance score is only ${n}/100)`,
    slow: (s) => `the site takes ${s} seconds to load`,
    lowScore: (n) => `the site has a low performance score (${n}/100)`,
    slowGeneric: "it loads pretty slowly",
    pageSpeed: (n, s) => `on mobile, Google rates the site ${n}/100 for speed and the main content takes ${s} seconds to appear`,
    outdated: "the design looks outdated",
    wordpress: "it's built on WordPress, which tends to be heavier and more exposed to security issues",
    offline: "the site isn't loading",
    certificate: "browsers show a security warning when opening the site (certificate problem)",
    hostingSuspended: "the site isn't loading - the hosting looks suspended",
    hostingExpired: "the site isn't loading - the hosting looks expired",
    domainExpired: "the site isn't loading - the domain looks expired",
    parked: "the site's domain looks parked or for sale",
    defaultPage: "the site isn't set up - only a default server page shows",
  },
};

// Frase limpa pro motivo de "site quebrado", ou null quando o motivo nao e
// confiavel o bastante pra afirmar numa mensagem (ex: pagina "vazia" de site
// feito em JavaScript) - ai segue pro resto da analise em vez de acusar
// algo que pode ser falso. Nunca devolve o texto tecnico do erro.
function describeBrokenReason(reason: string | null | undefined, locale: Locale): string | null {
  if (!reason) return null;
  const t = PROBLEM_PHRASES[locale];
  if (reason.startsWith("site fora do ar")) {
    return /ENOTFOUND|ECONNREFUSED|status code (404|410|5\d\d)/.test(reason) ? t.offline : null;
  }
  if (reason === "certificado de segurança com problema") return t.certificate;
  if (reason === "hospedagem suspensa") return t.hostingSuspended;
  if (reason === "hospedagem vencida") return t.hostingExpired;
  if (reason.startsWith("domínio expirado")) return t.domainExpired;
  if (
    reason.startsWith("domínio estacionado") ||
    reason.startsWith("domínio à venda") ||
    reason.startsWith("redireciona pra domínio estacionado")
  ) {
    return t.parked;
  }
  if (reason.startsWith("página padrão")) return t.defaultPage;
  return null;
}

// Converte os achados reais da analise do site numa frase natural, pra
// mensagem citar algo especifico e verdadeiro em vez de soar generica. Sem
// analise ou sem achado, cai numa frase neutra em vez de deixar
// {{problema}} vazio no meio do texto.
export function buildProblemSummaryForLocale(analysis: SiteAnalysisSummary | null, locale: Locale): string {
  const t = PROBLEM_PHRASES[locale];
  if (!analysis) return t.fallback;

  // Site fora do ar e o achado mais forte - sobrepoe performance/visual.
  if (analysis.is_broken) {
    const claim = describeBrokenReason(analysis.broken_reason, locale);
    if (claim) return claim;
  }

  const parts: string[] = [];
  const hasPageSpeed = typeof analysis.ps_mobile_score === "number" && typeof analysis.ps_lcp_ms === "number";
  if (hasPageSpeed) {
    // Achado real do Google. So vira problema abaixo do que o proprio Google
    // considera bom (nota 90, conteudo principal em 2,5s) - site rapido nao
    // ganha frase de "problema de velocidade" so pra ter o que dizer.
    if (analysis.ps_mobile_score! < 90 || analysis.ps_lcp_ms! > 2500) {
      const lcp = (analysis.ps_lcp_ms! / 1000).toFixed(1);
      parts.push(t.pageSpeed(analysis.ps_mobile_score!, locale === "en" ? lcp : lcp.replace(".", ",")));
    }
  } else if (analysis.is_slow || (analysis.performance_score !== null && analysis.performance_score < 90)) {
    // Sem PageSpeed: nota aproximada pelo tempo de uma requisicao. Limiar
    // permissivo: qualquer nota abaixo de 90 ja vale citar o numero.
    const seconds = extractLoadSeconds(analysis.notes, locale);
    if (seconds && analysis.performance_score !== null) parts.push(t.slowWithScore(seconds, analysis.performance_score));
    else if (seconds) parts.push(t.slow(seconds));
    else if (analysis.performance_score !== null) parts.push(t.lowScore(analysis.performance_score));
    else parts.push(t.slowGeneric);
  }
  if (analysis.is_outdated) parts.push(t.outdated);
  if (analysis.is_wordpress) parts.push(t.wordpress);

  if (parts.length === 0) return t.fallback;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} ${t.and} ${parts[parts.length - 1]}`;
}

// Versao pt-BR (envio automatico de WhatsApp, que so roda no Brasil).
export function buildProblemSummary(analysis: SiteAnalysisSummary | null): string {
  return buildProblemSummaryForLocale(analysis, "pt-BR");
}

export function buildProblemSummaryFor(country: Country, analysis: SiteAnalysisSummary | null): string {
  return buildProblemSummaryForLocale(analysis, COUNTRIES[country].locale);
}

export interface TemplateLeadData {
  name: string;
  category: string;
  address: string | null;
  problem?: string;
}

// Nome do Google Business às vezes vem com tagline de marketing colada
// depois de um "|" (ex: "Ivan and Mike Team | Luxury Real Estate Experts /
// Advisors | Miami, FL") - fica estranho como sujeito de frase no email.
// Corta tudo a partir do primeiro "|" e usa só o nome de verdade.
function cleanBusinessName(name: string): string {
  const cleaned = name.split("|")[0].trim();
  return cleaned || name.trim();
}

export function renderTemplate(template: MessageTemplate, lead: TemplateLeadData): MessageTemplate {
  const vars: Record<string, string> = {
    empresa: cleanBusinessName(lead.name),
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
