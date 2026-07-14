import { supabase } from "./supabase";

export interface WhatsappConversationSummary {
  id: string;
  leadName: string;
  leadCategory: string;
  phone: string;
  status: string;
  aiEnabled: boolean;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
}

export interface WhatsappChatMessage {
  direction: "inbound" | "outbound";
  body: string;
  createdAt: string;
}

export interface WhatsappConversationDetail {
  id: string;
  leadName: string;
  leadCategory: string;
  leadAddress: string | null;
  phone: string;
  status: string;
  aiEnabled: boolean;
  messages: WhatsappChatMessage[];
}

export async function getWhatsappConversations(): Promise<WhatsappConversationSummary[]> {
  const { data: conversations, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone, status, ai_enabled, lead_id, leads(name, category)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const ids = (conversations ?? []).map((c) => c.id);

  // Puxa todas as mensagens dessas conversas ordenadas da mais recente pra
  // mais antiga, e fica só com a primeira ocorrência de cada conversation_id
  // - vira a prévia da última mensagem sem precisar de uma query por linha.
  const { data: messages } = ids.length
    ? await supabase
        .from("whatsapp_messages")
        .select("conversation_id, body, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };

  const lastMessageByConversation = new Map<string, { body: string; created_at: string }>();
  for (const m of messages ?? []) {
    if (!lastMessageByConversation.has(m.conversation_id)) {
      lastMessageByConversation.set(m.conversation_id, m);
    }
  }

  return (conversations ?? []).map((c) => {
    const lead = Array.isArray(c.leads) ? c.leads[0] : c.leads;
    const last = lastMessageByConversation.get(c.id);
    return {
      id: c.id,
      leadName: lead?.name ?? "Lead removido",
      leadCategory: lead?.category ?? "",
      phone: c.phone,
      status: c.status,
      aiEnabled: c.ai_enabled,
      lastMessageBody: last?.body ?? null,
      lastMessageAt: last?.created_at ?? null,
    };
  });
}

export async function getWhatsappConversationDetail(
  id: string
): Promise<WhatsappConversationDetail | null> {
  // Sem isso, um id mal formado (ex: alguem digitando a URL na mao) faz o
  // Postgres rejeitar o filtro ".eq" com um erro de sintaxe de uuid, que
  // sem tratamento vira uma tela de erro 500 em vez de um 404 normal.
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isValidUuid) return null;

  const { data: conversation, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone, status, ai_enabled, leads(name, category, address)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!conversation) return null;

  const lead = Array.isArray(conversation.leads) ? conversation.leads[0] : conversation.leads;

  const { data: messages, error: messagesError } = await supabase
    .from("whatsapp_messages")
    .select("direction, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (messagesError) throw new Error(messagesError.message);

  return {
    id: conversation.id,
    leadName: lead?.name ?? "Lead removido",
    leadCategory: lead?.category ?? "",
    leadAddress: lead?.address ?? null,
    phone: conversation.phone,
    status: conversation.status,
    aiEnabled: conversation.ai_enabled,
    messages: (messages ?? []).map((m) => ({
      direction: m.direction as "inbound" | "outbound",
      body: m.body,
      createdAt: m.created_at,
    })),
  };
}
