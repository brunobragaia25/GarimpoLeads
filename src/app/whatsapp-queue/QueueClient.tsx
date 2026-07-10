"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageCircle, SkipForward, ExternalLink, Globe, Trash2 } from "lucide-react";

export interface QueueLead {
  id: string;
  name: string;
  category: string;
  address: string | null;
  phone: string;
  website: string | null;
  waLink: string;
  message: string;
}

export function QueueClient({ leads }: { leads: QueueLead[] }) {
  const router = useRouter();
  const [queueLeads, setQueueLeads] = useState(leads);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const current = queueLeads[index];
  const remaining = queueLeads.length - index;

  async function markContactedAndAdvance() {
    if (!current) return;
    setLoading(true);
    await fetch(`/api/leads/${current.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "contacted" }),
    });
    setLoading(false);
    setDoneCount((n) => n + 1);
    setIndex((i) => i + 1);
  }

  function skip() {
    setIndex((i) => i + 1);
  }

  // Remove o lead da fila (e do banco) sem precisar voltar pro dashboard
  // pra excluir - o próximo item da fila ocupa a mesma posição sozinho,
  // já que a exclusão tira o item atual da lista em vez de só avançar o
  // índice.
  async function handleDelete() {
    if (!current) return;
    if (!confirm(`Excluir o lead "${current.name}" permanentemente? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/leads/${current.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erro ao excluir");
      return;
    }
    setQueueLeads((prev) => prev.filter((l) => l.id !== current.id));
  }

  if (!current) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Fila concluída!
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {doneCount} lead(s) marcado(s) como contatado(s) nessa sessão.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Voltar ao dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {remaining} restante(s) na fila &middot; {doneCount} enviado(s) nessa sessão
      </p>

      <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {current.name}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {current.category}
              {current.address ? ` · ${current.address}` : ""}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{current.phone}</p>
          </div>
          {current.website && (
            <a
              href={current.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <Globe className="h-4 w-4" />
              Ver site
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {current.message}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href={current.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            Abrir WhatsApp
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            onClick={markContactedAndAdvance}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading ? "Marcando..." : "Marquei como contatado, próximo"}
          </button>

          <button
            onClick={skip}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <SkipForward className="h-4 w-4" />
            Pular (não marcar)
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Excluir lead"
            className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
