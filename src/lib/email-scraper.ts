import axios from "axios";

export interface ScrapedEmailResult {
  email: string | null;
  confidence: number;
  source: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

const BLOCKED_DOMAINS = [
  "sentry.io",
  "wixpress.com",
  "godaddy.com",
  "example.com",
  "example.com.br",
  "exemplo.com",
  "exemplo.com.br",
  "test.com",
  "teste.com",
  "teste.com.br",
  "email.com",
  "wordpress.com",
  "wordpress.org",
  "schema.org",
  "w3.org",
  "google.com",
  "gstatic.com",
  "cloudflare.com",
  "letsencrypt.org",
  "github.com",
  "yourdomain.com",
  "domain.com",
  "sentry.wixpress.com",
];

// Prefixos de placeholder que sites deixam esquecido no template (nunca
// sao um contato real). Pegos direto de bounces reais na producao.
const BLOCKED_LOCAL_PARTS = ["exemplo", "teste", "test", "example", "seuemail", "seunome"];

const BLOCKED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

const CONTACT_PAGE_PATTERN = /href="([^"]*(?:contato|contact|fale-?conosco|sobre)[^"]*)"/i;

// Fallback quando nao acha link de contato no HTML da home (comum em sites
// com menu renderizado via JS, onde o regex acima nunca casa) - tenta os
// caminhos mais comuns direto, mesmo sem link visivel na home.
const COMMON_CONTACT_PATHS = ["/contato", "/contact", "/fale-conosco", "/atendimento"];

// Alguns sites tem mailto: com espaco (as vezes %20) grudado antes do
// email por erro de template; sem isso o email vira "%20fulano@..." e
// sempre da bounce.
function cleanEmail(raw: string): string {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // ignora payload que não é URL-encoding válido
  }
  return decoded.trim();
}

function isUsableEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  if (BLOCKED_DOMAINS.some((domain) => lower.endsWith(domain))) return false;
  if (lower.startsWith("noreply@") || lower.startsWith("no-reply@")) return false;
  const localPart = lower.split("@")[0];
  if (BLOCKED_LOCAL_PARTS.includes(localPart)) return false;
  return true;
}

function extractEmails(html: string): { mailto: string[]; text: string[] } {
  const mailto = Array.from(html.matchAll(MAILTO_REGEX)).map((m) =>
    cleanEmail(m[1]).toLowerCase()
  );
  const text = Array.from(html.matchAll(EMAIL_REGEX)).map((m) => cleanEmail(m[0]).toLowerCase());
  return {
    mailto: [...new Set(mailto)].filter(isUsableEmail),
    text: [...new Set(text)].filter(isUsableEmail),
  };
}

function resolveUrl(base: string, path: string): string | null {
  try {
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string, timeout = 8000): Promise<string> {
  const { data } = await axios.get<string>(url, {
    timeout,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GarimpoLeadsBot/1.0)" },
  });
  return data;
}

// Tenta os caminhos comuns de contato direto, um por um, parando no
// primeiro que responder com um email. Timeout curto (5s) porque isso so
// roda quando a home ja nao deu certo - nao vale gastar o orcamento de
// tempo do cron inteiro tentando caminho que nem existe.
async function tryCommonContactPaths(website: string): Promise<ScrapedEmailResult | null> {
  for (const path of COMMON_CONTACT_PATHS) {
    const url = resolveUrl(website, path);
    if (!url) continue;

    try {
      const html = await fetchHtml(url, 5000);
      const found = extractEmails(html);

      if (found.mailto.length > 0) {
        return { email: found.mailto[0], confidence: 80, source: `mailto_guessed_${path}` };
      }
      if (found.text.length > 0) {
        return { email: found.text[0], confidence: 50, source: `text_guessed_${path}` };
      }
    } catch {
      // caminho nao existe ou deu erro - tenta o proximo
    }
  }
  return null;
}

export async function scrapeEmailFromWebsite(website: string): Promise<ScrapedEmailResult> {
  try {
    const homeHtml = await fetchHtml(website);
    const home = extractEmails(homeHtml);

    if (home.mailto.length > 0) {
      return { email: home.mailto[0], confidence: 90, source: "mailto_homepage" };
    }
    if (home.text.length > 0) {
      return { email: home.text[0], confidence: 60, source: "text_homepage" };
    }

    const contactMatch = homeHtml.match(CONTACT_PAGE_PATTERN);
    if (contactMatch) {
      const contactUrl = resolveUrl(website, contactMatch[1]);
      if (contactUrl) {
        try {
          const contactHtml = await fetchHtml(contactUrl);
          const contact = extractEmails(contactHtml);

          if (contact.mailto.length > 0) {
            return { email: contact.mailto[0], confidence: 85, source: "mailto_contact_page" };
          }
          if (contact.text.length > 0) {
            return { email: contact.text[0], confidence: 55, source: "text_contact_page" };
          }
        } catch {
          // link de contato existia mas falhou ao carregar - segue pro
          // fallback de caminhos comuns abaixo
        }
      }
    }

    const guessed = await tryCommonContactPaths(website);
    if (guessed) return guessed;

    return { email: null, confidence: 0, source: "not_found" };
  } catch {
    return { email: null, confidence: 0, source: "fetch_error" };
  }
}
