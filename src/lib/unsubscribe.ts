// Mantém o CRON_SECRET como chave de propósito: trocar a chave aqui
// invalidaria os links de descadastro de todos os emails JÁ enviados
// (o token vai embutido na URL do rodapé e no header List-Unsubscribe).
// A sessão do dashboard usa SESSION_SECRET separado (ver auth.ts).
async function sign(value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.CRON_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createUnsubscribeToken(leadId: string): Promise<string> {
  return sign(`unsubscribe:${leadId}`);
}

export async function verifyUnsubscribeToken(
  leadId: string,
  token: string
): Promise<boolean> {
  const expected = await createUnsubscribeToken(leadId);
  if (token.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
