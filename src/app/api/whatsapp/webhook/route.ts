import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyWhatsappSignature, verifyWhatsappWebhookChallenge } from "@/lib/whatsapp-webhook";
import { sendWhatsappText } from "@/lib/whatsapp";
import { generateWhatsappReply } from "@/lib/whatsapp-ai";

// Handshake que a Meta faz uma unica vez ao registrar a URL do webhook no
// painel do app - so devolve o challenge se o verify token bater.
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (!verifyWhatsappWebhookChallenge(mode, token) || !challenge) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

interface WhatsappWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          id: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}

async function handleIncomingMessage(from: string, waMessageId: string, body: string) {
  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("id, lead_id, ai_enabled")
    .eq("phone", from)
    .maybeSingle();

  // Mensagem de um numero sem conversa registrada (ninguem mandou template
  // pra esse contato pelo sistema) - fora do escopo do auto-reply, ignora.
  if (!conversation) return;

  await supabase.from("whatsapp_messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    body,
    wa_message_id: waMessageId,
  });
  await supabase
    .from("whatsapp_conversations")
    .update({ last_inbound_at: new Date().toISOString() })
    .eq("id", conversation.id);

  // Depois que o humano manda uma mensagem manual pela tela de chat, a IA
  // fica pausada nessa conversa especifica ate ele reativar - evita a IA
  // responder por cima de uma intervencao manual.
  if (!conversation.ai_enabled) return;

  const { data: lead } = await supabase
    .from("leads")
    .select("name, category, address, website")
    .eq("id", conversation.lead_id)
    .single();
  if (!lead) return;

  const { data: history } = await supabase
    .from("whatsapp_messages")
    .select("direction, body")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(20);

  const reply = await generateWhatsappReply(
    {
      name: lead.name,
      category: lead.category,
      address: lead.address,
      hasWebsite: !!lead.website,
    },
    (history ?? []).map((m) => ({ direction: m.direction as "inbound" | "outbound", body: m.body })),
    body
  );

  const replyWaId = await sendWhatsappText(from, reply);

  const now = new Date().toISOString();
  await supabase.from("whatsapp_messages").insert({
    conversation_id: conversation.id,
    direction: "outbound",
    body: reply,
    wa_message_id: replyWaId,
  });
  await supabase
    .from("whatsapp_conversations")
    .update({ last_outbound_at: now, status: "open" })
    .eq("id", conversation.id);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!(await verifyWhatsappSignature(signature, rawBody))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload: WhatsappWebhookPayload = JSON.parse(rawBody);

  // A Meta so espera 200 de volta pra parar de reentregar o evento -
  // processa cada mensagem de texto recebida, ignorando outros tipos
  // (imagem, audio, status de entrega/leitura, etc.) por enquanto.
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (message.type === "text" && message.text?.body) {
          try {
            await handleIncomingMessage(message.from, message.id, message.text.body);
          } catch (err) {
            console.error("Erro processando mensagem do WhatsApp:", err);
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
