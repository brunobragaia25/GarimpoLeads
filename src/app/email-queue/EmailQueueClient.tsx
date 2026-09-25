"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  SkipForward,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";

export interface EmailQueueLead {
  id: string;
  name: string;
  category: string;
  address: string | null;
  email: string;
  website: string | null;
  mapsUrl: string | null;
  subject: string;
  body: string;
}

const UPCOMING_COUNT = 8;

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-current/30 px-1.5 py-0.5 font-mono text-[10px] opacity-70">{children}</kbd>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={`Copiar ${label}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

export function EmailQueueClient({ leads, total }: { leads: EmailQueueLead[]; total: number }) {
  const router = useRouter();
  const [queueLeads, setQueueLeads] = useState(leads);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [opened, setOpened] = useState(false);
  const [lastDone, setLastDone] = useState<{ lead: EmailQueueLead; index: number } | null>(null);

  const current = queueLeads[index];
  const upcoming = queueLeads.slice(index + 1, index + 1 + UPCOMING_COUNT);
  // Conta com o total real (so um lote veio pro navegador).
  const removed = leads.length - queueLeads.length;
  const remaining = Math.max(0, total - removed - index);
  const batchDone = !current && remaining > 0;

  const goTo = useCallback((nextIndex: number) => {
    setIndex(nextIndex);
    setOpened(false);
  }, []);

  const openEmailApp = useCallback(() => {
    if (!current) return;
    window.location.href = `mailto:${current.email}?subject=${encodeURIComponent(current.subject)}&body=${encodeURIComponent(current.body)}`;
    setOpened(true);
  }, [current]);

  const markContactedAndAdvance = useCallback(async () => {
    if (!current || loading) return;
    setLoading(true);
    await fetch(`/api/leads/${current.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "contacted" }),
    });
    setLoading(false);
    setDoneCount((n) => n + 1);
    setLastDone({ lead: current, index });
    goTo(index + 1);
  }, [current, loading, index, goTo]);

  const skip = useCallback(() => {
    if (!current) return;
    goTo(index + 1);
  }, [current, index, goTo]);

  async function undoLast() {
    if (!lastDone) return;
    setLoading(true);
    await fetch(`/api/leads/${lastDone.lead.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });
    setLoading(false);
    setDoneCount((n) => Math.max(0, n - 1));
    goTo(lastDone.index);
    setLastDone(null);
  }

  // Traz um lead da lista "a seguir" pra ser o atual.
  function bringToFront(id: string) {
    setQueueLeads((prev) => {
      const from = prev.findIndex((l) => l.id === id);
      if (from <= index) return prev;
      const next = [...prev];
      const [picked] = next.splice(from, 1);
      next.splice(index, 0, picked);
      return next;
    });
    setOpened(false);
  }

  // Exclui de vez sem voltar pro dashboard - o proximo lead ocupa a mesma
  // posicao, ja que a exclusao tira o item da lista em vez de avancar.
  async function handleDelete() {
    if (!current) return;
    if (!confirm(`Excluir o lead "${current.name}" permanentemente? Essa ação não pode ser desfeita.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/leads/${current.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erro ao excluir");
      return;
    }
    setQueueLeads((prev) => prev.filter((l) => l.id !== current.id));
    setOpened(false);
  }

  // Atalhos: E abre no app de email, Enter marca e avanca, S pula.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target;
      if (target instanceof Element && target.closest("input, textarea, select, button, a, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        openEmailApp();
      } else if (e.key === "Enter") {
        e.preventDefault();
        markContactedAndAdvance();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        skip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openEmailApp, markContactedAndAdvance, skip]);

  const undoBar = lastDone && (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
      <span className="inline-flex min-w-0 items-center gap-2">
        <Check className="h-4 w-4 shrink-0" />
        <span className="truncate">
          <strong className="font-medium">{lastDone.lead.name}</strong> marcado como contatado
        </span>
      </span>
      <button
        onClick={undoLast}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-emerald-100 disabled:opacity-50 dark:hover:bg-emerald-900/50"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Desfazer
      </button>
    </div>
  );

  if (!current) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        {undoBar}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {batchDone ? "Lote concluído!" : "Fila concluída!"}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {doneCount} lead(s) marcado(s) como contatado(s) nessa sessão.
            {batchDone && ` Ainda restam ${remaining} na fila.`}
          </p>
          {batchDone ? (
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Carregar próximo lote
            </button>
          ) : (
            <button
              onClick={() => router.push("/")}
              className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Voltar ao dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  const sessionTotal = doneCount + remaining;
  const progress = sessionTotal > 0 ? Math.round((doneCount / sessionTotal) * 100) : 0;
  const fullMessage = current.subject ? `${current.subject}\n\n${current.body}` : current.body;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        {undoBar}

        <article className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <header className="flex items-start justify-between gap-4 border-b border-zinc-200 p-6 dark:border-zinc-800">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{current.category}</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{current.name}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                {current.website ? (
                  <a
                    href={current.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <Globe className="h-4 w-4" />
                    Ver site
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <XCircle className="h-4 w-4" />
                    Sem site
                  </span>
                )}
                {current.mapsUrl && (
                  <a
                    href={current.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                  >
                    <MapPin className="h-4 w-4 text-zinc-400" />
                    Google Maps
                  </a>
                )}
              </div>
              {current.address && <p className="mt-2 text-xs leading-relaxed text-zinc-500">{current.address}</p>}
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Excluir lead"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Excluir
            </button>
          </header>

          {/* Previa do email, no formato de um email de verdade */}
          <div className="p-6">
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="divide-y divide-zinc-200 bg-zinc-50 text-sm dark:divide-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-16 shrink-0 text-xs text-zinc-500">Para</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-900 dark:text-zinc-50">
                    {current.email}
                  </span>
                  <CopyButton text={current.email} label="email" />
                </div>
                {current.subject && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-16 shrink-0 text-xs text-zinc-500">Assunto</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-50">{current.subject}</span>
                    <CopyButton text={current.subject} label="assunto" />
                  </div>
                )}
              </div>
              <div className="relative bg-white px-4 py-4 dark:bg-zinc-950">
                <div className="absolute right-2 top-2">
                  <CopyButton text={current.body} label="mensagem" />
                </div>
                <p className="whitespace-pre-wrap pr-20 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {current.body}
                </p>
              </div>
            </div>
          </div>

          <footer className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <button
              onClick={openEmailApp}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                opened
                  ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
              }`}
            >
              <Mail className="h-4 w-4" />
              {opened ? "Abrir de novo" : "Abrir no app de email"}
              <Kbd>E</Kbd>
            </button>
            <button
              onClick={markContactedAndAdvance}
              disabled={loading}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                opened
                  ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                  : "border border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              }`}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Enviei, próximo
              <Kbd>Enter</Kbd>
            </button>
            <span className="hidden text-xs text-zinc-400 sm:inline">
              ou <CopyButton text={fullMessage} label="assunto + mensagem" />
            </span>
            <button
              onClick={skip}
              className="ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            >
              <SkipForward className="h-4 w-4" />
              Pular
              <Kbd>S</Kbd>
            </button>
          </footer>
        </article>
      </div>

      <aside className="flex flex-col gap-4">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nessa sessão</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{doneCount}</p>
              <p className="text-xs text-zinc-500">enviados</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{remaining.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-zinc-500">na fila</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <p className="px-5 pt-5 text-xs font-semibold uppercase tracking-wider text-zinc-400">A seguir</p>
          {upcoming.length === 0 ? (
            <p className="px-5 pb-5 pt-3 text-sm text-zinc-400">Nenhum outro lead nesse lote.</p>
          ) : (
            <ul className="mt-2 pb-2">
              {upcoming.map((lead) => (
                <li key={lead.id}>
                  <button
                    onClick={() => bringToFront(lead.id)}
                    title="Atender esse agora"
                    className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-zinc-800 dark:text-zinc-200">{lead.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{lead.email}</span>
                    </span>
                    {!lead.website && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        sem site
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
