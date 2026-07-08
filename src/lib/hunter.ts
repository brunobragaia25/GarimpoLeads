import axios from "axios";

export interface EmailResult {
  email: string | null;
  confidence: number;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^www\./, "").replace(/\//g, "");
  }
}

export async function findEmailForWebsite(website: string): Promise<EmailResult> {
  const domain = extractDomain(website);

  const { data } = await axios.get("https://api.hunter.io/v2/domain-search", {
    params: {
      domain,
      api_key: process.env.HUNTER_API_KEY,
      limit: 10,
    },
  });

  const emails: Array<{ value: string; type: string; confidence: number }> =
    data?.data?.emails ?? [];

  if (emails.length === 0) {
    return { email: null, confidence: 0 };
  }

  const generic = emails.filter((e) => e.type === "generic");
  const best = (generic.length > 0 ? generic : emails).sort(
    (a, b) => b.confidence - a.confidence
  )[0];

  return { email: best.value, confidence: best.confidence };
}
