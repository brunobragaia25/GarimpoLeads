// Resend usa o padrão Svix pra assinar webhooks.
// https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export async function verifyResendWebhook(
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  body: string
): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;

  let secretBytes: Uint8Array;
  try {
    secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  } catch {
    // Segredo mal configurado (base64 inválido) - trata como assinatura
    // inválida em vez de derrubar a rota com 500.
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent)
  );
  const expected = bytesToBase64(new Uint8Array(signatureBytes));

  const receivedSignatures = svixSignature
    .split(" ")
    .map((s) => s.split(",")[1])
    .filter(Boolean);

  return receivedSignatures.includes(expected);
}
