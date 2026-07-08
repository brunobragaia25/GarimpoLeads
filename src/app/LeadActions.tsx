"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      className="text-xs text-zinc-400 hover:text-red-600 hover:underline disabled:opacity-50 dark:hover:text-red-400"
    >
      ignorar
    </button>
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
