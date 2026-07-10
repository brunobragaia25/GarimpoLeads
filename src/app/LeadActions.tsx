"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Briefcase, Check, Loader2, Pencil, Trash2, Undo2, X } from "lucide-react";

export function EditablePhone({ leadId, phone }: { leadId: string; phone: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: value }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erro ao salvar telefone");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setValue(phone ?? "");
              setEditing(false);
            }
          }}
          placeholder="(11) 91234-5678"
          className="w-32 rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          title="Salvar"
          className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => {
            setValue(phone ?? "");
            setEditing(false);
          }}
          disabled={saving}
          title="Cancelar"
          className="text-zinc-400 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Editar telefone"
      className="group inline-flex items-center gap-1 text-left hover:text-emerald-600 dark:hover:text-emerald-400"
    >
      {phone ?? "-"}
      <Pencil className="h-3 w-3 text-zinc-300 group-hover:text-emerald-600 dark:text-zinc-600 dark:group-hover:text-emerald-400" />
    </button>
  );
}

export function DeleteLeadButton({ leadId, name }: { leadId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Excluir o lead "${name}" permanentemente? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erro ao excluir");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Excluir lead"
      className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}

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
      title="Ignorar lead"
      className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-red-400"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
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
  { value: "pending", label: "Pendente" },
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
