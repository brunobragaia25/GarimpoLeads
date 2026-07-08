import axios from "axios";

export interface SiteAnalysisResult {
  has_website: boolean;
  is_wordpress: boolean | null;
  performance_score: number | null;
  is_outdated: boolean | null;
  is_slow: boolean | null;
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
      notes: "Sem site - prospect direto",
    };
  }

  const startedAt = Date.now();
  try {
    const { data: html } = await axios.get<string>(website, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GarimpoLeadsBot/1.0)" },
    });
    const durationMs = Date.now() - startedAt;

    return {
      has_website: true,
      is_wordpress: detectWordPress(html),
      performance_score: scoreFromDuration(durationMs),
      is_outdated: detectOutdated(html),
      is_slow: durationMs > 3000,
      notes: `Carregou em ${durationMs}ms`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return {
      has_website: true,
      is_wordpress: null,
      performance_score: 0,
      is_outdated: null,
      is_slow: true,
      notes: `Falha ao acessar site: ${message}`,
    };
  }
}
