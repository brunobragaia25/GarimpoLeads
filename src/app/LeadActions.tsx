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

export function RespondedButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleMarkResponded() {
    setLoading(true);
    await fetch(`/api/leads/${leadId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "responded" }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleMarkResponded}
      disabled={loading}
      className="text-xs text-zinc-400 hover:text-emerald-600 hover:underline disabled:opacity-50 dark:hover:text-emerald-400"
    >
      marcar respondido
    </button>
  );
}
