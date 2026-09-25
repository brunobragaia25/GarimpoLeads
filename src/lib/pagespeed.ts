// PageSpeed Insights (Lighthouse do Google, no celular): achados reais de
// velocidade pra citar na mensagem, no lugar da nota calculada so pelo
// tempo de uma requisicao. API gratuita (25 mil consultas/dia com chave).
// Precisa da API "PageSpeed Insights" ativada no projeto do Google Cloud e
// da chave em PAGESPEED_API_KEY.

export interface PageSpeedResult {
  mobileScore: number; // 0-100
  lcpMs: number; // tempo ate o conteudo principal aparecer
}

// Erro de cota/permissao: nao adianta continuar o lote.
export class PageSpeedQuotaError extends Error {}

// Formato da resposta: lighthouseResult.categories.performance.score (0-1)
// e lighthouseResult.audits["largest-contentful-paint"].numericValue (ms).
export function parsePageSpeed(json: unknown): PageSpeedResult | null {
  const lh = (json as { lighthouseResult?: { categories?: { performance?: { score?: number | null } }; audits?: Record<string, { numericValue?: number }> } })
    ?.lighthouseResult;
  const score = lh?.categories?.performance?.score;
  const lcp = lh?.audits?.["largest-contentful-paint"]?.numericValue;
  if (typeof score !== "number" || typeof lcp !== "number") return null;
  return { mobileScore: Math.round(score * 100), lcpMs: Math.round(lcp) };
}

export async function fetchPageSpeed(url: string, apiKey: string, timeoutMs = 55_000): Promise<PageSpeedResult | null> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "mobile");
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("key", apiKey);

  const res = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 429 || res.status === 403) {
    throw new PageSpeedQuotaError(`PageSpeed API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  // 400/500: o Google nao conseguiu abrir aquele site - sem achado, sem erro.
  if (!res.ok) return null;
  return parsePageSpeed(await res.json());
}
