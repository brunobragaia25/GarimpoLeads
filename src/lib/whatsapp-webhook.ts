// A Evolution nao assina o corpo do webhook como a Meta fazia - a URL
// cadastrada na instancia leva um token secreto (?token=...) e so aceitamos
// evento que chegue com ele.
export function verifyWhatsappWebhookToken(token: string | null): boolean {
  const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (!expected || !token || token.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Status de entrega da Evolution (ack do WhatsApp Web) -> os mesmos nomes
// que a Meta usava e que ja estao gravados em whatsapp_messages.delivery_status.
const DELIVERY_STATUS: Record<string, string> = {
  SERVER_ACK: "sent",
  DELIVERY_ACK: "delivered",
  READ: "read",
  PLAYED: "read",
  ERROR: "failed",
};

export function toDeliveryStatus(evolutionStatus: string | undefined): string | null {
  return (evolutionStatus && DELIVERY_STATUS[evolutionStatus]) || null;
}

// O WhatsApp passou a mandar parte dos contatos como "@lid" (id anonimo) em
// vez do numero - a Evolution manda o numero real em remoteJidAlt/senderPn
// nesses casos. Grupo e status ficam de fora.
export function phoneFromJids(...jids: Array<string | undefined>): string | null {
  const jid = jids.find((j) => j?.endsWith("@s.whatsapp.net"));
  return jid ? jid.split("@")[0].split(":")[0] : null;
}
