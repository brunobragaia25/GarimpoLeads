import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyWhatsappSignature, verifyWhatsappWebhookChallenge } from "@/lib/whatsapp-webhook";
import { sendWhatsappText } from "@/lib/whatsapp";
import { generateWhatsappReply } from "@/lib/whatsapp-ai";
import { logAiUsage } from "@/lib/ai-usage";
import { detectNegativeIntent } from "@/lib/negative-intent";
import { detectBotReply } from "@/lib/bot-reply-detection";
import { updateMessageDeliveryStatus } from "@/lib/whatsapp-chats";
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
        statuses?: Array<{
          id: string;
          status: string;
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
  isBotReply: boolean,
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
    // So marca last_inbound_at quando for resposta de verdade - resposta
    // automatica do outro lado nao significa que um humano viu a mensagem,
    // entao nao pode contar como "ja respondeu" (isso bloquearia o
    // follow-up pra sempre pra quem nunca teve chance de ver nada).
    if (!isBotReply) {
      // Se o Bruno tinha "apagado" (exclusao suave) essa conversa da lista e
      // o lead respondeu de verdade depois, reaparece na lista de novo em
      // vez de ficar escondida pra sempre.
      await supabase
        .from("whatsapp_conversations")
        .update({ last_inbound_at: new Date().toISOString(), deleted_at: null })
        .eq("id", existing.id);
    }
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
      last_inbound_at: isBotReply ? null : new Date().toISOString(),
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

  // Se a primeira mensagem que chegou desse numero novo ja e uma resposta
  // automatica (autoresponder do proprio numero), nao faz sentido acordar o
  // Bruno com "lead quente" - ainda nao apareceu nenhum humano na conversa.
  if (!isBotReply) {
    // Lead quente (site/Ads) tem prioridade maior que um frio - avisa na
    // hora, mesmo antes de saber se a IA vai marcar handoff na resposta.
    const chatUrl = `${process.env.APP_URL}/whatsapp-chats/${newConversation.id}`;
    await notifyTelegram(
      `Lead quente no WhatsApp (via site/Ads)\n\nNome: ${profileName || "não informado"}\nTelefone: ${from}\n\n${chatUrl}`
    );
  }

  return newConversation;
}

// Sinal generico de loop de bot, independente de idioma/formato: se a MESMA
// mensagem ja apareceu antes vinda do lead nessa conversa, e quase certeza
// de que e um autoresponder mandando o mesmo texto de novo (pessoa real nao
// repete a mensagem identica sozinha) - pega padroes que os regex de
// bot-reply-detection.ts nao previram.
async function isRepeatedInboundMessage(conversationId: string, body: string): Promise<boolean> {
  const normalized = body.trim().toLowerCase();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("body")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(6);

  // A mensagem atual ja foi inserida em findOrCreateConversation antes de
  // chegar aqui, entao 2+ ocorrencias identicas = ja repetiu pelo menos uma vez.
  const matches = (data ?? []).filter((m) => m.body.trim().toLowerCase() === normalized);
  return matches.length >= 2;
}

async function handleIncomingMessage(from: string, waMessageId: string, body: string, profileName?: string) {
  // Calculado antes de criar/achar a conversa - decide ali dentro se
  // last_inbound_at deve ser marcado (resposta automatica nao conta como
  // "o lead respondeu de verdade", senao o follow-up fica bloqueado pra
  // sempre pra quem nunca teve chance de ver a mensagem).
  const isBotReply = detectBotReply(body);
  const conversation = await findOrCreateConversation(from, waMessageId, body, isBotReply, profileName);

  // Falha ao criar lead/conversa - já logado dentro de findOrCreateConversation.
  if (!conversation) return;

  // Mensagem automatica do outro lado (autoresponder, assistente virtual
  // do proprio lead, etc.) - nao responde nada, pra nao entrar num loop de
  // duas IAs conversando sozinhas gastando tokens de verdade a cada troca.
  // Verificado antes do resto (inclusive da notificacao) pra nao acordar o
  // Bruno no celular/Mac toda vez que um bot repete a mesma mensagem.
  if (isBotReply) return;
  if (await isRepeatedInboundMessage(conversation.id, body)) return;

  const { data: leadForNotify } = await supabase
    .from("leads")
    .select("name")
    .eq("id", conversation.lead_id)
    .maybeSingle();

  // Avisa no Telegram (aparece como notificacao nativa no celular e no Mac,
  // via app do Telegram) em toda resposta de verdade - independe da IA
  // estar ativa ou nao nessa conversa, pra nunca passar batido uma resposta
  // so porque o Bruno ja tinha assumido a conversa manualmente antes.
  const chatUrlForNotify = `${process.env.APP_URL}/whatsapp-chats/${conversation.id}`;
  await notifyTelegram(
    `Nova resposta no WhatsApp\n\nLead: ${leadForNotify?.name ?? "desconhecido"}\n\n${chatUrlForNotify}`
  );

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
      .update({
        last_outbound_at: now,
        status: "open",
        // Persiste o sinal de handoff (nao so o aviso do Telegram, que se
        // perde no meio de outras mensagens) - fica visivel na lista de
        // chats ate o Bruno assumir a conversa manualmente.
        ...(reply.needsHandoff ? { needs_handoff: true, handoff_reason: reply.handoffReason } : {}),
        // Sticky: uma vez que a IA confirma que teve gente de verdade
        // respondendo, fica marcado pro resto da conversa (nao some se uma
        // mensagem seguinte for ambigua).
        ...(reply.isHumanReply ? { human_confirmed_at: now } : {}),
      })
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
  // (imagem, audio, etc.) por enquanto, alem dos status de entrega/leitura
  // das mensagens que a gente mandou (sent/delivered/read/failed).
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

      for (const statusUpdate of change.value?.statuses ?? []) {
        try {
          await updateMessageDeliveryStatus(statusUpdate.id, statusUpdate.status);
        } catch (err) {
          console.error("Erro atualizando status de entrega do WhatsApp:", err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
