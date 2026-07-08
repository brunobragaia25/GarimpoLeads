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

const BLOCKED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

const CONTACT_PAGE_PATTERN = /href="([^"]*(?:contato|contact|fale-?conosco|sobre)[^"]*)"/i;

function isUsableEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  if (BLOCKED_DOMAINS.some((domain) => lower.endsWith(domain))) return false;
  if (lower.startsWith("noreply@") || lower.startsWith("no-reply@")) return false;
  return true;
}

function extractEmails(html: string): { mailto: string[]; text: string[] } {
  const mailto = Array.from(html.matchAll(MAILTO_REGEX)).map((m) => m[1].toLowerCase());
  const text = Array.from(html.matchAll(EMAIL_REGEX)).map((m) => m[0].toLowerCase());
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

async function fetchHtml(url: string): Promise<string> {
  const { data } = await axios.get<string>(url, {
    timeout: 8000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GarimpoLeadsBot/1.0)" },
  });
  return data;
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
        const contactHtml = await fetchHtml(contactUrl);
        const contact = extractEmails(contactHtml);

        if (contact.mailto.length > 0) {
          return { email: contact.mailto[0], confidence: 85, source: "mailto_contact_page" };
        }
        if (contact.text.length > 0) {
          return { email: contact.text[0], confidence: 55, source: "text_contact_page" };
        }
      }
    }

    return { email: null, confidence: 0, source: "not_found" };
  } catch {
    return { email: null, confidence: 0, source: "fetch_error" };
  }
}
