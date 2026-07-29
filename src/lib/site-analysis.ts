import axios from "axios";

export interface SiteAnalysisResult {
  has_website: boolean;
  is_wordpress: boolean | null;
  performance_score: number | null;
  is_outdated: boolean | null;
  is_slow: boolean | null;
  is_broken: boolean | null;
  broken_reason: string | null;
  notes: string;
}

const MODERN_INDICATORS = [
  "flexbox",
  "grid-template",
  "custom-properties",
  "preload",
  "aspect-ratio",
  "loading=\"lazy\"",
];

const OLD_INDICATORS = [
  "table-layout",
  "<table",
  "spacer.gif",
  "<font",
  "<applet",
  "frameset",
];

function detectWordPress(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("wp-content") ||
    lower.includes("wp-includes") ||
    lower.includes("/wp-json") ||
    lower.includes("wordpress")
  );
}

function detectOutdated(html: string): boolean {
  const lower = html.toLowerCase();
  const modernCount = MODERN_INDICATORS.filter((i) => lower.includes(i)).length;
  const oldCount = OLD_INDICATORS.filter((i) => lower.includes(i)).length;
  return oldCount > modernCount;
}

// Frases comuns em paginas de hospedagem vencida/suspensa, dominio
// estacionado a venda, ou pagina padrao de servidor sem site configurado -
// site "abre" (200 OK), mas nao existe nenhum site real pro visitante ver.
const BROKEN_SITE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /conta.{0,20}suspens/i, reason: "hospedagem suspensa" },
  { pattern: /account.{0,10}(has been )?suspended/i, reason: "hospedagem suspensa" },
  { pattern: /hospedagem.{0,20}(expirou|vencid|cancelad)/i, reason: "hospedagem vencida" },
  { pattern: /domain (has )?expired/i, reason: "domínio expirado" },
  { pattern: /dom[ií]nio.{0,15}expir/i, reason: "domínio expirado" },
  { pattern: /this domain (is parked|may be for sale|has expired)/i, reason: "domínio estacionado/à venda" },
  { pattern: /domain is parked/i, reason: "domínio estacionado" },
  { pattern: /buy this domain/i, reason: "domínio à venda" },
  { pattern: /comprar (este|esse) dom[ií]nio/i, reason: "domínio à venda" },
  { pattern: /renove (seu|o) dom[ií]nio/i, reason: "domínio expirado" },
  { pattern: /apache2 (ubuntu|debian|centos) default page/i, reason: "página padrão do servidor (sem site configurado)" },
  { pattern: /welcome to nginx/i, reason: "página padrão do servidor (sem site configurado)" },
  { pattern: /^index of \//im, reason: "listagem de diretório (sem site configurado)" },
  { pattern: /cpanel.{0,20}(default|em breve)/i, reason: "página padrão de hospedagem" },
  { pattern: /esta [ée] a p[áa]gina padr[ãa]o/i, reason: "página padrão de hospedagem" },
];

const PARKING_HOSTS = ["sedo.com", "dan.com", "hugedomains.com", "afternic.com", "bodis.com", "parkingcrew.net"];

function detectBroken(
  html: string,
  finalUrl: string | undefined
): { is_broken: boolean; reason: string | null } {
  if (finalUrl) {
    try {
      const host = new URL(finalUrl).hostname.toLowerCase();
      const parkingHost = PARKING_HOSTS.find((h) => host.includes(h));
      if (parkingHost) return { is_broken: true, reason: `redireciona pra domínio estacionado (${parkingHost})` };
    } catch {
      // URL final invalida - ignora, segue pra checagem de conteudo
    }
  }

  const match = BROKEN_SITE_PATTERNS.find((p) => p.pattern.test(html));
  if (match) return { is_broken: true, reason: match.reason };

  // Pagina "em branco" real (menos que uma tag html minima) costuma ser
  // apontamento de DNS errado ou hospedagem sem conteudo publicado.
  const textLength = html.replace(/<[^>]*>/g, "").trim().length;
  if (textLength < 30) return { is_broken: true, reason: "página carrega praticamente vazia" };

  return { is_broken: false, reason: null };
}

function scoreFromDuration(durationMs: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - durationMs / 50)));
}

export async function analyzeSite(website?: string): Promise<SiteAnalysisResult> {
  if (!website) {
    return {
      has_website: false,
      is_wordpress: null,
      performance_score: null,
      is_outdated: null,
      is_slow: null,
      is_broken: null,
      broken_reason: null,
      notes: "Sem site - prospect direto",
    };
  }

  const startedAt = Date.now();
  try {
    const response = await axios.get<string>(website, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GarimpoLeadsBot/1.0)" },
    });
    const durationMs = Date.now() - startedAt;
    const html = response.data;
    // responseUrl reflete a URL final apos redirects (ex: dominio expirado
    // redirecionando pro site do registrador vender ele de novo).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalUrl = (response.request as any)?.res?.responseUrl as string | undefined;
    const broken = detectBroken(html, finalUrl);

    return {
      has_website: true,
      is_wordpress: detectWordPress(html),
      performance_score: scoreFromDuration(durationMs),
      is_outdated: detectOutdated(html),
      is_slow: durationMs > 3000,
      is_broken: broken.is_broken,
      broken_reason: broken.reason,
      notes: `Carregou em ${durationMs}ms`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    // Erro de rede (DNS nao resolve, conexao recusada, timeout, HTTP
    // 4xx/5xx) e o sinal mais forte de "site fora do ar" - apontamento
    // errado, hospedagem cancelada ou dominio nem existe mais.
    return {
      has_website: true,
      is_wordpress: null,
      performance_score: 0,
      is_outdated: null,
      is_slow: true,
      is_broken: true,
      broken_reason: `site fora do ar (${message})`,
      notes: `Falha ao acessar site: ${message}`,
    };
  }
}
