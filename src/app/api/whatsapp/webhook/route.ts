import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyWhatsappSignature, verifyWhatsappWebhookChallenge } from "@/lib/whatsapp-webhook";
import { sendWhatsappText } from "@/lib/whatsapp";
import { generateWhatsappReply } from "@/lib/whatsapp-ai";
import { logAiUsage } from "@/lib/ai-usage";
import { detectNegativeIntent } from "@/lib/negative-intent";
import { detectBotReply } from "@/lib/bot-reply-detection";
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
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
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

// Lead que responde ao template da prospecção fria já tem linha em `leads`
// (veio da raspagem do Google Maps). Mensagem espontânea de um número sem
// conversa registrada é outro caso: lead quente que iniciou contato sozinho
// (botão de WhatsApp do site, anúncio) - cria lead e conversa na hora em vez
// de ignorar, como o sistema fazia antes.
async function findOrCreateConversation(
  from: string,
  waMessageId: string,
  body: string,
  profileName?: string
): Promise<{ id: string; lead_id: string; ai_enabled: boolean } | null> {
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("id, lead_id, ai_enabled")
    .eq("phone", from)
    .maybeSingle();

  if (existing) {
    await supabase.from("whatsapp_messages").insert({
      conversation_id: existing.id,
      direction: "inbound",
      body,
      wa_message_id: waMessageId,
    });
    await supabase
      .from("whatsapp_conversations")
      .update({ last_inbound_at: new Date().toISOString() })
      .eq("id", existing.id);
    return existing;
  }

  const { data: newLead, error: leadError } = await supabase
    .from("leads")
    .insert({
      name: profileName || "Lead via WhatsApp",
      category: "Contato via site/Ads",
      phone: from,
      source: "inbound_whatsapp",
    })
    .select("id")
    .single();
  if (leadError || !newLead) {
    console.error("Erro criando lead inbound:", leadError?.message);
    return null;
  }

  const { data: newConversation, error: convError } = await supabase
    .from("whatsapp_conversations")
    .insert({
      lead_id: newLead.id,
      phone: from,
      status: "open",
      ai_enabled: true,
      last_inbound_at: new Date().toISOString(),
    })
    .select("id, lead_id, ai_enabled")
    .single();
  if (convError || !newConversation) {
    console.error("Erro criando conversa inbound:", convError?.message);
    return null;
  }

  await supabase.from("whatsapp_messages").insert({
    conversation_id: newConversation.id,
    direction: "inbound",
    body,
    wa_message_id: waMessageId,
  });

  // Lead quente (site/Ads) tem prioridade maior que um frio - avisa na
  // hora, mesmo antes de saber se a IA vai marcar handoff na resposta.
  const chatUrl = `${process.env.APP_URL}/whatsapp-chats/${newConversation.id}`;
  await notifyTelegram(
    `Lead quente no WhatsApp (via site/Ads)\n\nNome: ${profileName || "não informado"}\nTelefone: ${from}\n\n${chatUrl}`
  );

  return newConversation;
}

async function handleIncomingMessage(from: string, waMessageId: string, body: string, profileName?: string) {
  const conversation = await findOrCreateConversation(from, waMessageId, body, profileName);

  // Falha ao criar lead/conversa - já logado dentro de findOrCreateConversation.
  if (!conversation) return;

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

  // Mensagem automatica do outro lado (autoresponder, assistente virtual
  // do proprio lead, etc.) - nao responde nada, pra nao entrar num loop de
  // duas IAs conversando sozinhas gastando tokens de verdade a cada troca.
  if (detectBotReply(body)) return;

  const { data: lead } = await supabase
    .from("leads")
    .select("name, category, address, website, source")
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
        isInbound: lead.source === "inbound_whatsapp",
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
      const contacts = change.value?.contacts ?? [];
      for (const message of change.value?.messages ?? []) {
        if (message.type === "text" && message.text?.body) {
          const profileName = contacts.find((c) => c.wa_id === message.from)?.profile?.name;
          try {
            await handleIncomingMessage(message.from, message.id, message.text.body, profileName);
          } catch (err) {
            console.error("Erro processando mensagem do WhatsApp:", err);
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
