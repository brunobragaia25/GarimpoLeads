"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  BotOff,
  Check,
  CheckCheck,
  CheckSquare,
  Loader2,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import type { WhatsappConversationDetail } from "@/lib/whatsapp-chats";

// Tiques ao estilo WhatsApp: 1 cinza = enviado, 2 cinza = entregue,
// 2 azul = lido. Sem status ainda (null) nao mostra nada, evita
// afirmar "enviado" antes da Meta confirmar de verdade.
function DeliveryTicks({ status }: { status: string | null }) {
  if (status === "sent") return <Check className="h-3 w-3" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-300" />;
  if (status === "failed") return <span className="text-red-300">!</span>;
  return null;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
// Regex separada (sem "g") so pra testar - reusar a mesma instancia global
// no .test() dentro do map mantém lastIndex entre chamadas e da resultado
// errado a cada segunda checagem.
const URL_TEST = /^https?:\/\/[^\s]+$/;
// Sem "g" e sem ancoras - usada com .match() pra achar o primeiro link
// dentro do texto ainda sendo digitado (que pode ter mais coisa em volta).
const URL_TEST_ANY = /https?:\/\/[^\s]+/;

interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

// Detecta link no texto e renderiza como <a> clicavel, igual o WhatsApp real
// - sem isso o link aparecia so como texto simples, sem jeito de abrir.
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        URL_TEST.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

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
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [dismissedPreviewUrl, setDismissedPreviewUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Acha o primeiro link no texto sendo digitado e busca a previa (titulo,
  // descricao, imagem), igual o WhatsApp real mostra antes de mandar.
  // Debounce de 500ms pra nao disparar uma busca a cada tecla.
  useEffect(() => {
    const match = message.match(URL_TEST_ANY);
    const url = match?.[0] ?? null;

    if (!url || url === dismissedPreviewUrl) {
      setLinkPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        setLinkPreview(data);
      } catch {
        setLinkPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [message, dismissedPreviewUrl]);

  function toggleSelected(messageId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === conversation.messages.length
        ? new Set()
        : new Set(conversation.messages.map((m) => m.id))
    );
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const res = await fetch(`/api/whatsapp-chats/${conversation.id}/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds: Array.from(selectedIds) }),
    });
    setBulkDeleting(false);
    if (!res.ok) {
      setError("Erro ao excluir mensagens selecionadas");
      return;
    }
    setSelectedIds(new Set());
    router.refresh();
  }

  // Busca mensagem nova a cada poucos segundos, sem precisar recarregar a
  // pagina na mao - o router.refresh() so busca de novo o server component,
  // preserva o estado local (texto digitado, etc).
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [router]);

  // Zera a badge de "nao lida" assim que o Bruno abre a conversa.
  useEffect(() => {
    fetch(`/api/whatsapp-chats/${conversation.id}/mark-read`, { method: "POST" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  async function handleDeleteConversation() {
    setDeletingConversation(true);
    const res = await fetch(`/api/whatsapp-chats/${conversation.id}`, { method: "DELETE" });
    setDeletingConversation(false);
    if (!res.ok) {
      setError("Erro ao excluir conversa");
      return;
    }
    router.push("/whatsapp-chats");
  }

  async function handleDeleteMessage(messageId: string) {
    setDeletingMessageId(messageId);
    const res = await fetch(`/api/whatsapp-chats/${conversation.id}/messages/${messageId}`, {
      method: "DELETE",
    });
    setDeletingMessageId(null);
    if (!res.ok) {
      setError("Erro ao excluir mensagem");
      return;
    }
    router.refresh();
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length]);

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
    setLinkPreview(null);
    setDismissedPreviewUrl(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
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
        <button
          onClick={handleDeleteConversation}
          disabled={deletingConversation}
          title="Excluir conversa inteira"
          className="inline-flex shrink-0 items-center justify-center rounded-full p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          {deletingConversation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {conversation.needsHandoff && (
        <div className="flex items-center gap-2 border-b border-orange-200 bg-orange-50 px-4 py-2 text-xs font-medium text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
          🔥 A IA sinalizou que essa conversa precisa de você
          {conversation.handoffReason ? `: ${conversation.handoffReason}` : ""}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2 dark:border-zinc-900 dark:bg-zinc-900/50">
        <button
          onClick={toggleSelectAll}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {selectedIds.size === conversation.messages.length && conversation.messages.length > 0 ? (
            <CheckSquare className="h-3.5 w-3.5" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          Selecionar tudo
        </button>
        <button
          onClick={handleBulkDelete}
          disabled={selectedIds.size === 0 || bulkDeleting}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          {bulkDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Excluir selecionadas ({selectedIds.size})
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conversation.messages.length === 0 && (
          <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
            Nenhuma mensagem trocada ainda.
          </p>
        )}
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-center gap-1.5 ${
              m.direction === "outbound" ? "justify-end" : "justify-start"
            }`}
          >
            {m.direction === "outbound" && (
              <>
                <button
                  onClick={() => toggleSelected(m.id)}
                  className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                >
                  {selectedIds.has(m.id) ? (
                    <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDeleteMessage(m.id)}
                  disabled={deletingMessageId === m.id}
                  title="Excluir mensagem"
                  className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  {deletingMessageId === m.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                m.direction === "outbound"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
              }`}
            >
              <p className="whitespace-pre-wrap">
                <Linkified text={m.body} />
              </p>
              <p
                className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                  m.direction === "outbound" ? "text-emerald-100" : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {formatTime(m.createdAt)}
                {m.direction === "outbound" && <DeliveryTicks status={m.deliveryStatus} />}
              </p>
            </div>
            {m.direction === "inbound" && (
              <>
                <button
                  onClick={() => handleDeleteMessage(m.id)}
                  disabled={deletingMessageId === m.id}
                  title="Excluir mensagem"
                  className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  {deletingMessageId === m.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={() => toggleSelected(m.id)}
                  className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                >
                  {selectedIds.has(m.id) ? (
                    <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-zinc-100 p-3 dark:border-zinc-900">
        {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

        {loadingPreview && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            Buscando prévia do link...
          </div>
        )}

        {!loadingPreview && linkPreview && (linkPreview.title || linkPreview.image) && (
          <div className="relative mb-2 flex overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            {linkPreview.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={linkPreview.image}
                alt=""
                className="h-20 w-20 shrink-0 object-cover"
              />
            )}
            <div className="min-w-0 flex-1 p-2.5 pr-8">
              {linkPreview.title && (
                <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                  {linkPreview.title}
                </p>
              )}
              {linkPreview.description && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {linkPreview.description}
                </p>
              )}
              <p className="mt-0.5 truncate text-[11px] text-zinc-400 dark:text-zinc-500">
                {linkPreview.siteName ?? linkPreview.url}
              </p>
            </div>
            <button
              onClick={() => setDismissedPreviewUrl(linkPreview.url)}
              title="Remover prévia"
              className="absolute right-1.5 top-1.5 rounded-full bg-black/10 p-1 text-zinc-600 hover:bg-black/20 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
              // Shift+Enter deixa o comportamento padrao (quebra de linha).
            }}
            rows={1}
            placeholder="Digite uma mensagem manual... (Shift+Enter pra quebrar linha - pausa a IA nessa conversa)"
            className="max-h-[120px] flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-600 p-2.5 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
