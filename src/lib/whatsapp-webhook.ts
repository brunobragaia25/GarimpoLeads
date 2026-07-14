// A Meta assina o corpo do webhook com HMAC-SHA256 usando o App Secret
// como chave, mandado no header X-Hub-Signature-256 como "sha256=<hex>".
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyWhatsappSignature(
  signatureHeader: string | null,
  body: string
): Promise<boolean> {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader) return false;

  const received = signatureHeader.replace(/^sha256=/, "");
  const expected = await hmacHex(secret, body);
  if (received.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < received.length; i++) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Handshake de verificação que a Meta faz uma vez ao registrar a URL do
// webhook (GET com hub.mode=subscribe, hub.verify_token, hub.challenge) -
// só devolvemos o challenge de volta se o token bater com o nosso.
export function verifyWhatsappWebhookChallenge(
  mode: string | null,
  token: string | null
): boolean {
  return mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
}
