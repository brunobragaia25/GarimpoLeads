import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyWhatsappSignature, verifyWhatsappWebhookChallenge } from "@/lib/whatsapp-webhook";
import { sendWhatsappText } from "@/lib/whatsapp";
import { generateWhatsappReply } from "@/lib/whatsapp-ai";
import { logAiUsage } from "@/lib/ai-usage";
import { detectNegativeIntent } from "@/lib/negative-intent";
import { notifyTelegram } from "@/lib/telegram";

const CLOSING_MESSAGE =
  "Sem problemas, obrigado pelo retorno! Vou parar de te enviar mensagens por aqui. Se mudar de ideia, é só chamar. 🙂";

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

  // Recusa clara detectada por regra simples (sem custo): manda uma resposta
  // educada fixa, fecha a conversa e marca o lead como perdido no pipeline,
  // sem gastar tokens de IA numa conversa que ja acabou.
  if (detectNegativeIntent(body)) {
    const closedAt = new Date().toISOString();
    const waId = await sendWhatsappText(from, CLOSING_MESSAGE);

    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      body: CLOSING_MESSAGE,
      wa_message_id: waId,
    });
    await supabase
      .from("whatsapp_conversations")
      .update({ last_outbound_at: closedAt, status: "closed", ai_enabled: false })
      .eq("id", conversation.id);

    const { data: existingOutreach } = await supabase
      .from("outreach")
      .select("id")
      .eq("lead_id", conversation.lead_id)
      .maybeSingle();
    if (existingOutreach) {
      await supabase
        .from("outreach")
        .update({ status: "closed_lost" })
        .eq("id", existingOutreach.id);
    } else {
      await supabase
        .from("outreach")
        .insert({ lead_id: conversation.lead_id, status: "closed_lost" });
    }
    return;
  }

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

  // Try/catch proprio aqui (em vez de deixar so o catch generico do POST)
  // pra gravar o erro como mensagem visivel no chat - sem isso, uma falha
  // na IA ou no envio so aparece nos logs da Vercel, sem jeito facil de
  // diagnosticar via dashboard/API.
  try {
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

    await logAiUsage(reply.inputTokens, reply.outputTokens);

    const replyWaId = await sendWhatsappText(from, reply.text);

    const now = new Date().toISOString();
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      body: reply.text,
      wa_message_id: replyWaId,
    });
    await supabase
      .from("whatsapp_conversations")
      .update({ last_outbound_at: now, status: "open" })
      .eq("id", conversation.id);

    // Handoff: a IA avaliou que essa conversa precisa da atencao do Bruno
    // agora (reuniao confirmada, pedido de contrato, reclamacao, etc.) -
    // avisa no Telegram com o link direto pro chat.
    if (reply.needsHandoff) {
      const chatUrl = `${process.env.APP_URL}/whatsapp-chats/${conversation.id}`;
      await notifyTelegram(
        `Atenção necessária no WhatsApp\n\nLead: ${lead.name}\nMotivo: ${reply.handoffReason}\n\n${chatUrl}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro gerando/enviando resposta da IA:", message);
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      body: `[ERRO - não enviado ao lead] ${message}`,
      wa_message_id: null,
    });
  }
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
