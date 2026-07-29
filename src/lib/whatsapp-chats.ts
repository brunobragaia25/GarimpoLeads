import { cache } from "react";
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
  hasUnread: boolean;
  hasReplied: boolean;
  isHumanConfirmed: boolean;
  isPinned: boolean;
  isFavorited: boolean;
  needsHandoff: boolean;
  handoffReason: string | null;
  isArchived: boolean;
}

export interface WhatsappChatMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  createdAt: string;
  deliveryStatus: string | null;
}

export interface WhatsappConversationDetail {
  id: string;
  leadName: string;
  leadCategory: string;
  leadAddress: string | null;
  leadWebsite: string | null;
  leadGoogleMapsUrl: string | null;
  phone: string;
  status: string;
  aiEnabled: boolean;
  needsHandoff: boolean;
  handoffReason: string | null;
  messages: WhatsappChatMessage[];
}

// cache() dedupe a busca dentro da mesma request - o layout.tsx (sidebar) e
// a page.tsx da raiz (que redireciona pra primeira conversa) chamam essa
// funcao no mesmo request, sem isso seria duas consultas identicas ao banco.
export const getWhatsappConversations = cache(async (): Promise<WhatsappConversationSummary[]> => {
  const { data: conversations, error } = await supabase
    .from("whatsapp_conversations")
    .select(
      "id, phone, status, ai_enabled, lead_id, last_inbound_at, last_read_at, pinned_at, favorited_at, needs_handoff, handoff_reason, human_confirmed_at, archived_at, created_at, leads(name, category)"
    )
    .is("deleted_at", null)
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

  const summaries = (conversations ?? []).map((c) => {
    const lead = Array.isArray(c.leads) ? c.leads[0] : c.leads;
    const last = lastMessageByConversation.get(c.id);
    const hasUnread =
      !!c.last_inbound_at && (!c.last_read_at || new Date(c.last_inbound_at) > new Date(c.last_read_at));
    return {
      id: c.id,
      leadName: lead?.name ?? "Lead removido",
      leadCategory: lead?.category ?? "",
      phone: c.phone,
      status: c.status,
      aiEnabled: c.ai_enabled,
      lastMessageBody: last?.body ?? null,
      lastMessageAt: last?.created_at ?? null,
      hasUnread,
      hasReplied: !!c.last_inbound_at,
      isHumanConfirmed: !!c.human_confirmed_at,
      isPinned: !!c.pinned_at,
      isFavorited: !!c.favorited_at,
      needsHandoff: !!c.needs_handoff,
      handoffReason: c.handoff_reason,
      isArchived: !!c.archived_at,
      pinnedAt: c.pinned_at,
      // So pra ordenar por ultima atividade - conversa nova sem mensagem
      // ainda cai pra data de criacao.
      activityAt: last?.created_at ?? c.created_at,
    };
  });

  // Fixadas sempre no topo (mais recentemente fixada primeiro), igual
  // WhatsApp. O resto ordena por ultima atividade (mensagem mais recente,
  // enviada ou recebida) - assim quem responde sobe pro topo da lista, em
  // vez de ficar preso na posicao de quando a conversa foi criada.
  return summaries
    .sort((a, b) => {
      if (a.isPinned && b.isPinned) {
        return new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime();
      }
      if (a.isPinned) return -1;
      if (b.isPinned) return 1;
      return new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime();
    })
    .map(({ pinnedAt: _pinnedAt, activityAt: _activityAt, ...rest }) => rest);
});

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
    .select(
      "id, phone, status, ai_enabled, needs_handoff, handoff_reason, leads(name, category, address, website, google_maps_url)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!conversation) return null;

  const lead = Array.isArray(conversation.leads) ? conversation.leads[0] : conversation.leads;

  const { data: messages, error: messagesError } = await supabase
    .from("whatsapp_messages")
    .select("id, direction, body, created_at, delivery_status")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (messagesError) throw new Error(messagesError.message);

  return {
    id: conversation.id,
    leadName: lead?.name ?? "Lead removido",
    leadCategory: lead?.category ?? "",
    leadAddress: lead?.address ?? null,
    leadWebsite: lead?.website ?? null,
    leadGoogleMapsUrl: lead?.google_maps_url ?? null,
    phone: conversation.phone,
    status: conversation.status,
    aiEnabled: conversation.ai_enabled,
    needsHandoff: conversation.needs_handoff,
    handoffReason: conversation.handoff_reason,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      direction: m.direction as "inbound" | "outbound",
      body: m.body,
      createdAt: m.created_at,
      deliveryStatus: m.delivery_status,
    })),
  };
}

// Chamado quando o Bruno abre a conversa - zera a badge de "nao lida" ate a
// proxima resposta do lead.
export async function markConversationAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setConversationPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setConversationFavorited(id: string, favorited: boolean): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ favorited_at: favorited ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setConversationArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Atualiza o status de entrega (sent/delivered/read/failed) de uma mensagem
// enviada, a partir do webhook de status da Meta. So regride com cuidado:
// nao sobrescreve "read" com "delivered" se um evento atrasado chegar fora
// de ordem (a Meta as vezes reentrega eventos).
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 1 };

export async function updateMessageDeliveryStatus(
  waMessageId: string,
  status: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("whatsapp_messages")
    .select("id, delivery_status")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();

  if (!existing) return;

  const currentRank = existing.delivery_status ? (STATUS_RANK[existing.delivery_status] ?? 0) : 0;
  const newRank = STATUS_RANK[status] ?? 0;
  if (newRank < currentRank) return;

  const { error } = await supabase
    .from("whatsapp_messages")
    .update({ delivery_status: status })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);
}

export async function deleteWhatsappMessage(conversationId: string, messageId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_messages")
    .delete()
    .eq("id", messageId)
    .eq("conversation_id", conversationId);
  if (error) throw new Error(error.message);
}

// Exclusao em lote - usado pelo modo de selecao multipla na tela de chat.
export async function deleteWhatsappMessages(conversationId: string, messageIds: string[]): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_messages")
    .delete()
    .eq("conversation_id", conversationId)
    .in("id", messageIds);
  if (error) throw new Error(error.message);
}

// Exclusao "suave": some da lista e do chat, mas NAO apaga a linha de
// verdade - se apagasse, o lead voltaria a parecer "nunca contatado" e o
// cron mandaria template de novo pro mesmo numero no dia seguinte. Manter a
// linha (so marcando deleted_at) preserva a contagem de envios do dia e
// impede reenvio duplicado pro mesmo lead.
export async function deleteWhatsappConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Exclusao em lote - usado pelo modo de selecao multipla na lista de chats.
export async function deleteWhatsappConversations(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);
}
