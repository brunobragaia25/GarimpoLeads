"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";

export function SendOutreachButton({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSend() {
    if (
      !confirm(
        `Isso vai enviar email de verdade para até ${pendingCount} leads. Confirma?`
      )
    ) {
      return;
    }

    setSending(true);
    setResult(null);

    const res = await fetch("/api/send-outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: pendingCount }),
    });

    const data = await res.json();
    setSending(false);

    if (res.ok) {
      setResult(`Enviados: ${data.sent} · Falhas: ${data.failed}`);
      router.refresh();
    } else {
      setResult(`Erro: ${data.error}`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handleSend}
        disabled={sending || pendingCount === 0}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? "Enviando..." : `Enviar para todos (${pendingCount})`}
      </button>
      {result && (
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {result}
        </span>
      )}
    </div>
  );
}
