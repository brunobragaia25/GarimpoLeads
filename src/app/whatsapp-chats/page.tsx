import { getWhatsappConversations } from "@/lib/whatsapp-chats";
import { PageHeader } from "../PageHeader";
import { MessageCircle, Bot, BotOff } from "lucide-react";

export const dynamic = "force-dynamic";

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

export default async function WhatsappChatsPage() {
  const conversations = await getWhatsappConversations();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/whatsapp-chats" />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Chats de WhatsApp
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Conversas iniciadas pelo template automático, com resposta da IA
            </p>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="mt-10 rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            Nenhuma conversa de WhatsApp ainda.
          </div>
        ) : (
          <div className="mt-6 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-900 dark:border-zinc-800 dark:bg-zinc-950">
            {conversations.map((c) => (
              <a
                key={c.id}
                href={`/whatsapp-chats/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {c.leadName}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                      {c.leadCategory}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {c.lastMessageBody ?? "Nenhuma mensagem ainda"}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDateTime(c.lastMessageAt)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      title={c.aiEnabled ? "IA respondendo automaticamente" : "IA pausada"}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        c.aiEnabled
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                      }`}
                    >
                      {c.aiEnabled ? <Bot className="h-3 w-3" /> : <BotOff className="h-3 w-3" />}
                      {c.aiEnabled ? "IA ativa" : "IA pausada"}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
