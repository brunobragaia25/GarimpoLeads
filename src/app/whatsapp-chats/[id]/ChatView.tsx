"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, BotOff, Loader2, Send } from "lucide-react";
import type { WhatsappConversationDetail } from "@/lib/whatsapp-chats";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ChatView({ conversation }: { conversation: WhatsappConversationDetail }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);

    const res = await fetch(`/api/whatsapp-chats/${conversation.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim() }),
    });

    setSending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao enviar mensagem");
      return;
    }

    setMessage("");
    router.refresh();
  }

  async function handleToggleAi() {
    setTogglingAi(true);
    await fetch(`/api/whatsapp-chats/${conversation.id}/toggle-ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !conversation.aiEnabled }),
    });
    setTogglingAi(false);
    router.refresh();
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-900">
        <a
          href="/whatsapp-chats"
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
            {conversation.leadName}
          </p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {conversation.leadCategory}
            {conversation.leadAddress ? ` · ${conversation.leadAddress}` : ""}
          </p>
        </div>
        <button
          onClick={handleToggleAi}
          disabled={togglingAi}
          title={conversation.aiEnabled ? "Pausar a IA nessa conversa" : "Reativar a IA nessa conversa"}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            conversation.aiEnabled
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
              : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900"
          }`}
        >
          {togglingAi ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : conversation.aiEnabled ? (
            <Bot className="h-3.5 w-3.5" />
          ) : (
            <BotOff className="h-3.5 w-3.5" />
          )}
          {conversation.aiEnabled ? "IA ativa" : "IA pausada"}
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conversation.messages.length === 0 && (
          <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
            Nenhuma mensagem trocada ainda.
          </p>
        )}
        {conversation.messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                m.direction === "outbound"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p
                className={`mt-1 text-right text-[10px] ${
                  m.direction === "outbound" ? "text-emerald-100" : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {formatTime(m.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-100 p-3 dark:border-zinc-900">
        {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Digite uma mensagem manual... (pausa a IA nessa conversa)"
            className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="inline-flex items-center justify-center rounded-full bg-emerald-600 p-2.5 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
