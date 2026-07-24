"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, BotOff, CheckSquare, Loader2, MessageCircleReply, Pin, Square, Star, Trash2 } from "lucide-react";
import { DeleteConversationButton } from "./DeleteConversationButton";
import type { WhatsappConversationSummary } from "@/lib/whatsapp-chats";

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const STATUS_LABELS: Record<string, string> = {
  template_sent: "Template enviado",
  open: "Conversa aberta",
  closed: "Fechada (+24h)",
};

export function ChatsList({ conversations }: { conversations: WhatsappConversationSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [filter, setFilter] = useState<"all" | "favorites" | "replied">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const visibleConversations =
    filter === "favorites"
      ? conversations.filter((c) => c.isFavorited)
      : filter === "replied"
        ? conversations.filter((c) => c.hasReplied)
        : conversations;

  async function handleTogglePin(e: React.MouseEvent, c: WhatsappConversationSummary) {
    e.preventDefault();
    e.stopPropagation();
    setTogglingId(c.id);
    await fetch(`/api/whatsapp-chats/${c.id}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !c.isPinned }),
    });
    setTogglingId(null);
    router.refresh();
  }

  async function handleToggleFavorite(e: React.MouseEvent, c: WhatsappConversationSummary) {
    e.preventDefault();
    e.stopPropagation();
    setTogglingId(c.id);
    await fetch(`/api/whatsapp-chats/${c.id}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorited: !c.isFavorited }),
    });
    setTogglingId(null);
    router.refresh();
  }

  function toggleSelected(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === visibleConversations.length
        ? new Set()
        : new Set(visibleConversations.map((c) => c.id))
    );
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const res = await fetch("/api/whatsapp-chats", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationIds: Array.from(selectedIds) }),
    });
    setBulkDeleting(false);
    if (!res.ok) {
      alert("Erro ao excluir conversas selecionadas");
      return;
    }
    setSelectedIds(new Set());
    router.refresh();
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Nenhuma conversa de WhatsApp ainda.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-3 pt-2 dark:border-zinc-800 dark:bg-zinc-900/50">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-t-md px-3 py-1.5 text-xs font-medium ${
            filter === "all"
              ? "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter("favorites")}
          className={`inline-flex items-center gap-1 rounded-t-md px-3 py-1.5 text-xs font-medium ${
            filter === "favorites"
              ? "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Star className="h-3 w-3" />
          Favoritas
        </button>
        <button
          onClick={() => setFilter("replied")}
          className={`inline-flex items-center gap-1 rounded-t-md px-3 py-1.5 text-xs font-medium ${
            filter === "replied"
              ? "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <MessageCircleReply className="h-3 w-3" />
          Respondidas
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          onClick={toggleSelectAll}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {selectedIds.size === visibleConversations.length && visibleConversations.length > 0 ? (
            <CheckSquare className="h-3.5 w-3.5" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          Selecionar
        </button>
        <button
          onClick={handleBulkDelete}
          disabled={selectedIds.size === 0 || bulkDeleting}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          {bulkDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Excluir ({selectedIds.size})
        </button>
      </div>

      {visibleConversations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {filter === "favorites"
            ? "Nenhuma conversa favoritada ainda."
            : filter === "replied"
              ? "Nenhuma conversa respondida ainda."
              : "Nenhuma conversa de WhatsApp ainda."}
        </div>
      ) : (
      <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900">
        {visibleConversations.map((c) => {
          const isActive = pathname === `/whatsapp-chats/${c.id}`;
          return (
            <Link
              key={c.id}
              href={`/whatsapp-chats/${c.id}`}
              className={`flex items-center gap-2 px-3 py-3 transition-colors ${
                isActive
                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              }`}
            >
              <button
                onClick={(e) => toggleSelected(e, c.id)}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              >
                {selectedIds.has(c.id) ? (
                  <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>

              {c.hasUnread && (
                <span title="Mensagem não lida" className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="flex min-w-0 items-center gap-1">
                    {c.isPinned && (
                      <Pin className="h-3 w-3 shrink-0 fill-current text-zinc-400 dark:text-zinc-500" />
                    )}
                    <span
                      className={`truncate text-sm text-zinc-900 dark:text-zinc-50 ${
                        c.hasUnread ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {c.leadName}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                    {formatDateTime(c.lastMessageAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {c.lastMessageBody ?? "Nenhuma mensagem ainda"}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    title={c.aiEnabled ? "IA respondendo automaticamente" : "IA pausada"}
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      c.aiEnabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                    }`}
                  >
                    {c.aiEnabled ? <Bot className="h-2.5 w-2.5" /> : <BotOff className="h-2.5 w-2.5" />}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  {c.needsHandoff && (
                    <span
                      title={c.handoffReason ?? "IA sinalizou que essa conversa precisa de atenção"}
                      className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                    >
                      🔥 Precisa de você
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={(e) => handleToggleFavorite(e, c)}
                disabled={togglingId === c.id}
                title={c.isFavorited ? "Remover dos favoritos" : "Favoritar conversa"}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-amber-500 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-amber-400"
              >
                <Star className={`h-4 w-4 ${c.isFavorited ? "fill-amber-400 text-amber-400" : ""}`} />
              </button>
              <button
                onClick={(e) => handleTogglePin(e, c)}
                disabled={togglingId === c.id}
                title={c.isPinned ? "Desafixar conversa" : "Fixar conversa"}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-200"
              >
                <Pin className={`h-4 w-4 ${c.isPinned ? "fill-zinc-500 text-zinc-500 dark:fill-zinc-300 dark:text-zinc-300" : ""}`} />
              </button>
              <DeleteConversationButton id={c.id} name={c.leadName} />
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}
