"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Briefcase, Check, Loader2, Undo2 } from "lucide-react";

export function IgnoreButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleIgnore() {
    if (!confirm("Marcar esse lead como ignorado? Ele não vai mais receber emails.")) {
      return;
    }
    setLoading(true);
    await fetch(`/api/leads/${leadId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ignored" }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleIgnore}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
    >
      <Ban className="h-3 w-3" />
      ignorar
    </button>
  );
}

export function SendToCRMButton({
  leadId,
  synced,
}: {
  leadId: string;
  synced: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!confirm("Enviar esse lead como cliente novo pro GestãoDevz?")) return;

    setLoading(true);
    setError(null);
    const res = await fetch(`/api/leads/${leadId}/send-to-crm`, { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      router.refresh();
    } else {
      setError(data.error ?? "Erro ao enviar");
    }
  }

  async function handleUndo() {
    if (!confirm("Desfazer o envio pro CRM? Isso APAGA o cliente lá no GestãoDevz também.")) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/send-to-crm`, { method: "DELETE" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      alert(data.error ?? "Erro ao desfazer");
      return;
    }
    router.refresh();
  }

  if (synced) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3" />
          no CRM
        </span>
        <button
          onClick={handleUndo}
          disabled={loading}
          title="Desfazer (apaga do GestãoDevz também)"
          className="text-zinc-400 hover:text-amber-600 disabled:opacity-50 dark:hover:text-amber-400"
        >
          <Undo2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        onClick={handleSend}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-600 disabled:opacity-50 dark:hover:text-emerald-400"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Briefcase className="h-3 w-3" />}
        enviar pro CRM
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

const PIPELINE_STAGES = [
  { value: "contacted", label: "Contatado" },
  { value: "responded", label: "Respondeu" },
  { value: "meeting_scheduled", label: "Reunião marcada" },
  { value: "proposal_sent", label: "Proposta enviada" },
  { value: "closed_won", label: "Fechado (ganho)" },
  { value: "closed_lost", label: "Fechado (perdido)" },
];

export function PipelineStageSelect({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: string) {
    setLoading(true);
    await fetch(`/api/leads/${leadId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {PIPELINE_STAGES.map((stage) => (
        <option key={stage.value} value={stage.value}>
          {stage.label}
        </option>
      ))}
    </select>
  );
}
