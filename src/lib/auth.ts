const COOKIE_NAME = "garimpo_session";

// Mesmo valor usado no maxAge do cookie no /api/login: o token embute a
// própria expiração assinada, então mesmo que o cookie vaze ele deixa de
// valer sozinho depois desse prazo (antes o valor era estático e eterno).
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// SESSION_SECRET é exclusivo da sessão do dashboard. Não reutilizar o
// CRON_SECRET aqui: ele viaja como bearer token nas chamadas de cron, e
// quem o descobrisse poderia forjar uma sessão de admin.
async function sign(value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.SESSION_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// A senha entra no conteúdo assinado pra que trocar a DASHBOARD_PASSWORD
// invalide todas as sessões existentes na hora.
function sessionPayload(expiresAtMs: number): string {
  return `session:${process.env.DASHBOARD_PASSWORD}:${expiresAtMs}`;
}

export async function createSessionCookieValue(): Promise<string> {
  const expiresAtMs = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const signature = await sign(sessionPayload(expiresAtMs));
  return `${expiresAtMs}.${signature}`;
}

export async function isValidSessionCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;

  const dotIndex = value.indexOf(".");
  if (dotIndex === -1) return false;

  const expiresAtMs = Number(value.slice(0, dotIndex));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;

  const signature = value.slice(dotIndex + 1);
  const expected = await sign(sessionPayload(expiresAtMs));
  if (signature.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function isValidPassword(password: string): boolean {
  return password === process.env.DASHBOARD_PASSWORD;
}

export { COOKIE_NAME };
