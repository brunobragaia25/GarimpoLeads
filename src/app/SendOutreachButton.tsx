"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      setResult(`Enviados: ${data.sent} | Falhas: ${data.failed}`);
      router.refresh();
    } else {
      setResult(`Erro: ${data.error}`);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSend}
        disabled={sending || pendingCount === 0}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {sending ? "Enviando..." : `Enviar para todos (${pendingCount})`}
      </button>
      {result && <span className="text-sm text-zinc-600 dark:text-zinc-400">{result}</span>}
    </div>
  );
}
