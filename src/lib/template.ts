import { supabase } from "./supabase";
import { COUNTRIES, b2bTemplateKey, isCountry, type Country, type Locale } from "./countries";
export { categoryTemplateKey } from "./countries";
import { getB2bCategories } from "./app-settings";

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
    body: "{Olá!|Oi!|Olá, tudo bem?} Eu me chamo Bruno e sou da DevzDesign (www.devzdesign.com.br), {nós trabalhamos com|trabalho com} desenvolvimento de websites.\n\n{Dei uma olhada|Dei uma passada} no site da {{empresa}} e {reparei|percebi|notei} que {{problema}}. Isso pode estar {afastando|deixando de atrair} quem pesquisa por {{categoria}} em {{cidade}}.\n\n{Posso te mandar|Posso te enviar|Quer que eu te mande} uma prévia de como ficaria um site novo pra {{empresa}}? {É de graça|Não tem custo|É sem custo}, você vê e decide se faz sentido.\n\n{Abraço|Um abraço|Abs},\nBruno Bragaia\nDevzDesign",
  },
  __whatsapp_no_site__: {
    subject: "",
    body: "{Olá!|Oi!|Olá, tudo bem?} Eu me chamo Bruno e sou da DevzDesign (www.devzdesign.com.br). {Procurei|Pesquisei} a {{empresa}} no Google e {percebi|notei} que vocês ainda não têm um site.\n\n{Eu ajudo|Ajudo} empresas locais a criarem sites personalizados para aparecer melhor no Google e conquistar mais clientes. {Gostaria de mostrar|Posso te mostrar} alguns dos trabalhos que já desenvolvi? {É só me responder por aqui.|Se tiver interesse, é só responder por aqui.|Me responde por aqui se quiser ver.}",
  },
  __followup__: {
    subject: "Re: sobre o site da {{empresa}}",
    body: "Oi, tudo bem?\n\nPassando só pra saber se você chegou a ver meu email anterior sobre o site da {{empresa}}. Fico à disposição se quiser trocar uma ideia.\n\nAbraço,\nBruno",
  },
  // ---- EUA
  __default_us__: {
    subject: "A new version of {{empresa}}'s website",
    body: "{Hi!|Hello!|Hi there!} My name is Bruno, I run DevzDesign, a web design studio. We build websites.\n\n{I took a look at|I had a look at} {{empresa}}'s website and {noticed|spotted} that {{problema}}. That could be turning away people searching for {{categoria}} in {{cidade}}.\n\n{Can I send you|Would you like me to send you} a quick preview of what a new website could look like for {{empresa}}? {It's free|There's no cost}, and you can decide if it makes sense. Just reply to this email.\n\nBest,\nBruno",
  },
  __no_site_us__: {
    subject: "A website for {{empresa}}",
    body: "{Hi!|Hello!|Hi there!} My name is Bruno, I run DevzDesign, a web design studio. I {searched for|looked up} {{empresa}} on Google and noticed you don't have a website yet.\n\nI help local businesses get custom websites that rank better on Google and bring in more customers. {Can I show you|Would you like to see} some of the work I've done? Just reply to this email.",
  },
  __followup_us__: {
    subject: "Re: about {{empresa}}'s website",
    body: "Hi again,\n\nJust checking if you had a chance to see my previous email about {{empresa}}'s website. Happy to chat if you're interested.\n\nBest,\nBruno",
  },
  // ---- Portugal (portugues europeu)
  __default_pt__: {
    subject: "Uma nova versão do site da {{empresa}}",
    body: "{Olá!|Olá, tudo bem?|Olá, como vai?} Chamo-me Bruno e sou da DevzDesign (www.devzdesign.com.br). Trabalhamos com desenvolvimento de websites.\n\n{Estive a ver|Dei uma vista de olhos a} o site da {{empresa}} e {reparei|notei} que {{problema}}. Isso pode estar a afastar quem procura {{categoria}} em {{cidade}}.\n\n{Posso enviar-lhe|Posso mandar-lhe} uma prévia de como ficaria um site novo para a {{empresa}}? {É gratuito|Não tem custos}, vê e decide se faz sentido.\n\n{Cumprimentos|Com os melhores cumprimentos},\nBruno Bragaia\nDevzDesign",
  },
  __no_site_pt__: {
    subject: "Um website para a {{empresa}}",
    body: "{Olá!|Olá, tudo bem?|Olá, como vai?} Chamo-me Bruno e sou da DevzDesign (www.devzdesign.com.br). {Pesquisei|Procurei} a {{empresa}} no Google e {reparei|notei} que ainda não têm website.\n\nAjudo empresas locais a criarem websites personalizados para aparecerem melhor no Google e conquistarem mais clientes. {Gostaria de mostrar-lhe|Posso mostrar-lhe} alguns dos trabalhos que já desenvolvi? {Basta responder a esta mensagem.|Se tiver interesse, basta responder por aqui.}",
  },
  __followup_pt__: {
    subject: "Re: sobre o site da {{empresa}}",
    body: "Olá,\n\nSó queria saber se chegaram a ver o meu email anterior sobre o site da {{empresa}}. Fico à disposição se quiserem conversar.\n\nCumprimentos,\nBruno",
  },
  // ---- Reino Unido
  __default_uk__: {
    subject: "A new version of {{empresa}}'s website",
    body: "{Hi!|Hello!|Hi there!} My name is Bruno, I run DevzDesign, a web design studio. We build websites.\n\n{I took a look at|I had a look at} {{empresa}}'s website and {noticed|spotted} that {{problema}}. That could be putting off people searching for {{categoria}} in {{cidade}}.\n\n{Can I send you|Would you like me to send you} a quick preview of what a new website could look like for {{empresa}}? {It's free|There's no cost}, and you can decide if it makes sense. Just reply to this email.\n\nKind regards,\nBruno",
  },
  __no_site_uk__: {
    subject: "A website for {{empresa}}",
    body: "{Hi!|Hello!|Hi there!} My name is Bruno, I run DevzDesign, a web design studio. I {searched for|looked up} {{empresa}} on Google and noticed you don't have a website yet.\n\nI help local businesses get custom websites that rank better on Google and bring in more customers. {Can I show you|Would you like to see} some of the work I've done? Just reply to this email.",
  },
  __followup_uk__: {
    subject: "Re: about {{empresa}}'s website",
    body: "Hi again,\n\nJust checking whether you had a chance to see my previous email about {{empresa}}'s website. Happy to have a chat if you're interested.\n\nKind regards,\nBruno",
  },
  // ---- Brasileiros nos EUA (negocio de imigrante brasileiro)
  __default_brus__: {
    subject: "Uma nova versão do site da {{empresa}}",
    body: "{Olá!|Oi!|Olá, tudo bem?} Eu me chamo Bruno, sou brasileiro e trabalho com desenvolvimento de sites pela DevzDesign (www.devzdesign.com.br).\n\n{Dei uma olhada|Dei uma passada} no site da {{empresa}} e {reparei|percebi|notei} que {{problema}}. Isso pode estar {afastando|deixando de atrair} quem pesquisa por {{categoria}} em {{cidade}}.\n\n{Posso te mandar|Posso te enviar|Quer que eu te mande} uma prévia de como ficaria um site novo pra {{empresa}}? {É de graça|Não tem custo|É sem custo}, você vê e decide se faz sentido.\n\n{Abraço|Um abraço|Abs},\nBruno Bragaia\nDevzDesign",
  },
  __no_site_brus__: {
    subject: "Um site para a {{empresa}}",
    body: "{Olá!|Oi!|Olá, tudo bem?} Eu me chamo Bruno, sou brasileiro e trabalho com desenvolvimento de sites pela DevzDesign (www.devzdesign.com.br). {Procurei|Pesquisei} a {{empresa}} no Google e {percebi|notei} que vocês ainda não têm um site.\n\nEu ajudo negócios locais a criarem sites personalizados pra aparecer melhor no Google e conquistar mais clientes. {Gostaria de mostrar|Posso te mostrar} alguns dos trabalhos que já desenvolvi? {É só me responder por aqui.|Se tiver interesse, é só responder por aqui.|Me responde por aqui se quiser ver.}",
  },
  __followup_brus__: {
    subject: "Re: sobre o site da {{empresa}}",
    body: "Oi, tudo bem?\n\nPassando só pra saber se você chegou a ver meu email anterior sobre o site da {{empresa}}. Fico à disposição se quiser trocar uma ideia.\n\nAbraço,\nBruno",
  },
  // ---- B2B (pitch pra empresa que vende pra empresa; categorias marcadas em Configuracoes)
  __b2b_br__: {
    subject: "Site institucional da {{empresa}}",
    body: "{Olá!|{{saudacao}}!|Olá, tudo bem?} Meu nome é Bruno, sou da DevzDesign (www.devzdesign.com.br). Fazemos sites institucionais para empresas que vendem para outras empresas.\n\nDei uma olhada na presença online da {{empresa}} e {{problema}}. Hoje, quem procura {{categoria}} em {{cidade}} costuma pesquisar o fornecedor no Google antes de pedir orçamento, e um site que passe credibilidade e facilite o pedido de cotação pesa nessa decisão.\n\nPosso te mandar uma prévia de como ficaria o site da {{empresa}}, com serviços, portfólio e formulário de orçamento? É sem custo, você avalia e decide.\n\n{Atenciosamente|Abraço},\nBruno Bragaia\nDevzDesign",
  },
  __b2b_no_site_br__: {
    subject: "Um site para a {{empresa}}",
    body: "{Olá!|{{saudacao}}!|Olá, tudo bem?} Meu nome é Bruno, sou da DevzDesign (www.devzdesign.com.br). Fazemos sites institucionais para empresas que vendem para outras empresas.\n\nNotei que a {{empresa}} ainda não tem site. Hoje, quem procura {{categoria}} em {{cidade}} costuma pesquisar o fornecedor no Google antes de pedir orçamento, e um site que passe credibilidade e facilite o pedido de cotação pesa nessa decisão.\n\nPosso montar uma prévia do site da {{empresa}}, com serviços, portfólio e formulário de orçamento? É sem custo, você avalia e decide. {É só me responder por aqui.|Se tiver interesse, é só responder por aqui.}",
  },
  __b2b_brus__: {
    subject: "Site institucional da {{empresa}}",
    body: "{Olá!|{{saudacao}}!|Olá, tudo bem?} Meu nome é Bruno, sou da DevzDesign (www.devzdesign.com.br). Fazemos sites institucionais para empresas que vendem para outras empresas.\n\nDei uma olhada na presença online da {{empresa}} e {{problema}}. Hoje, quem procura {{categoria}} em {{cidade}} costuma pesquisar o fornecedor no Google antes de pedir orçamento, e um site que passe credibilidade e facilite o pedido de cotação pesa nessa decisão.\n\nPosso te mandar uma prévia de como ficaria o site da {{empresa}}, com serviços, portfólio e formulário de orçamento? É sem custo, você avalia e decide.\n\n{Atenciosamente|Abraço},\nBruno Bragaia\nDevzDesign",
  },
  __b2b_no_site_brus__: {
    subject: "Um site para a {{empresa}}",
    body: "{Olá!|{{saudacao}}!|Olá, tudo bem?} Meu nome é Bruno, sou da DevzDesign (www.devzdesign.com.br). Fazemos sites institucionais para empresas que vendem para outras empresas.\n\nNotei que a {{empresa}} ainda não tem site. Hoje, quem procura {{categoria}} em {{cidade}} costuma pesquisar o fornecedor no Google antes de pedir orçamento, e um site que passe credibilidade e facilite o pedido de cotação pesa nessa decisão.\n\nPosso montar uma prévia do site da {{empresa}}, com serviços, portfólio e formulário de orçamento? É sem custo, você avalia e decide. {É só me responder por aqui.|Se tiver interesse, é só responder por aqui.}",
  },
  __b2b_pt__: {
    subject: "Site institucional da {{empresa}}",
    body: "{Olá!|Olá, tudo bem?|Olá, como vai?} Chamo-me Bruno e sou da DevzDesign (www.devzdesign.com.br). Desenvolvemos sites institucionais para empresas que vendem a outras empresas.\n\nEstive a ver a presença online da {{empresa}} e {{problema}}. Hoje, quem procura {{categoria}} em {{cidade}} costuma pesquisar o fornecedor no Google antes de pedir orçamento, e um site que transmita credibilidade e facilite o pedido de orçamento pesa nessa decisão.\n\nPosso enviar-lhe uma prévia de como ficaria o site da {{empresa}}, com serviços, portefólio e formulário de pedido de orçamento? É gratuito, avalia e decide.\n\n{Cumprimentos|Com os melhores cumprimentos},\nBruno Bragaia\nDevzDesign",
  },
  __b2b_no_site_pt__: {
    subject: "Um site para a {{empresa}}",
    body: "{Olá!|Olá, tudo bem?|Olá, como vai?} Chamo-me Bruno e sou da DevzDesign (www.devzdesign.com.br). Desenvolvemos sites institucionais para empresas que vendem a outras empresas.\n\nReparei que a {{empresa}} ainda não tem site. Hoje, quem procura {{categoria}} em {{cidade}} costuma pesquisar o fornecedor no Google antes de pedir orçamento, e um site que transmita credibilidade e facilite o pedido de orçamento pesa nessa decisão.\n\nPosso preparar uma prévia do site da {{empresa}}, com serviços, portefólio e formulário de pedido de orçamento? É gratuito, avalia e decide. Basta responder por aqui.",
  },
  __b2b_us__: {
    subject: "{{empresa}}'s website",
    body: "Hello, my name is Bruno and I run DevzDesign, a web design studio. We build professional websites for companies that sell to other businesses.\n\nI took a look at {{empresa}}'s online presence and noticed that {{problema}}. Buyers searching for {{categoria}} in {{cidade}} usually research a supplier on Google before requesting a quote, and a credible site with an easy quote request form matters in that decision.\n\nCan I send you a quick preview of what {{empresa}}'s website could look like, with services, a portfolio and a quote request form? It's free, and you can decide if it makes sense. Just reply to this email.\n\nBest,\nBruno",
  },
  __b2b_no_site_us__: {
    subject: "A website for {{empresa}}",
    body: "Hello, my name is Bruno and I run DevzDesign, a web design studio. We build professional websites for companies that sell to other businesses.\n\nI noticed that {{empresa}} doesn't have a website yet. Buyers searching for {{categoria}} in {{cidade}} usually research a supplier on Google before requesting a quote, and a credible site with an easy quote request form matters in that decision.\n\nCan I put together a quick preview of a website for {{empresa}}, with services, a portfolio and a quote request form? It's free, and you can decide if it makes sense. Just reply to this email.",
  },
  __b2b_uk__: {
    subject: "{{empresa}}'s website",
    body: "Hello, my name is Bruno and I run DevzDesign, a web design studio. We build professional websites for companies that sell to other businesses.\n\nI had a look at {{empresa}}'s online presence and noticed that {{problema}}. Buyers searching for {{categoria}} in {{cidade}} usually research a supplier on Google before requesting a quote, and a credible site with an easy quote request form matters in that decision.\n\nCan I send you a quick preview of what {{empresa}}'s website could look like, with services, a portfolio and a quote request form? It's free, and you can decide if it makes sense. Just reply to this email.\n\nKind regards,\nBruno",
  },
  __b2b_no_site_uk__: {
    subject: "A website for {{empresa}}",
    body: "Hello, my name is Bruno and I run DevzDesign, a web design studio. We build professional websites for companies that sell to other businesses.\n\nI noticed that {{empresa}} doesn't have a website yet. Buyers searching for {{categoria}} in {{cidade}} usually research a supplier on Google before requesting a quote, and a credible site with an easy quote request form matters in that decision.\n\nCan I put together a quick preview of a website for {{empresa}}, with services, a portfolio and a quote request form? It's free, and you can decide if it makes sense. Just reply to this email.",
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
    // Categoria marcada como B2B (Configuracoes) usa o pitch B2B do pais.
    if (!category.startsWith("__") && (await isB2bCategory(category, country))) {
      return getSpecialTemplate(b2bTemplateKey(country, false));
    }
  }
  return getSpecialTemplate(COUNTRIES[country].templateKeys.default);
}

async function isB2bCategory(category: string, country: Country): Promise<boolean> {
  const plain = category.replace(/^[A-Z]{2}:/, "").trim().toLowerCase();
  return (await getB2bCategories(country)).some((c) => c.trim().toLowerCase() === plain);
}

// Template de lead SEM site, por categoria: B2B tem pitch proprio, o resto usa
// o "sem site" padrao do pais. Devolve um mapa categoria -> template.
export async function getNoSiteTemplates(
  categories: string[],
  country: Country = "BR"
): Promise<Map<string, MessageTemplate>> {
  const [normal, b2bList] = await Promise.all([getWhatsappNoSiteTemplate(country), getB2bCategories(country)]);
  const b2bSet = new Set(b2bList.map((c) => c.trim().toLowerCase()));
  const b2b = categories.some((c) => b2bSet.has(c.trim().toLowerCase()))
    ? await getSpecialTemplate(b2bTemplateKey(country, true))
    : null;
  return new Map(categories.map((c) => [c, b2b && b2bSet.has(c.trim().toLowerCase()) ? b2b : normal]));
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

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Bom dia/Boa tarde/Boa noite pelo horario de Brasilia (quem envia). Usado via
// {{saudacao}} dentro de uma variacao, ex: {Olá!|{{saudacao}}!}.
function saudacao(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(now)
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function renderTemplate(template: MessageTemplate, lead: TemplateLeadData): MessageTemplate {
  const vars: Record<string, string> = {
    empresa: cleanBusinessName(lead.name),
    categoria: lead.category,
    cidade: extractCity(lead.address),
    problema: lead.problem ?? "tem alguns pontos que dava pra melhorar",
  };

  // Variacoes {a|b|c}: cada lead cai numa opcao fixa (calculada do nome+
  // endereco), entao a previa e o envio mostram o mesmo texto e a mensagem
  // nao sai identica pra todo mundo. Roda antes das variaveis {{x}}.
  const seed = `${lead.name}|${lead.address ?? ""}`;
  let group = 0;

  function render(text: string): string {
    return text
      .replace(/\{\{saudacao\}\}/g, saudacao())
      .replace(/\{([^{}|]*(?:\|[^{}|]*)+)\}/g, (_, options: string) => {
        const list = options.split("|");
        return list[hashString(`${seed}#${group++}`) % list.length];
      })
      .replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
  }

  return {
    subject: render(template.subject),
    body: render(template.body),
  };
}
