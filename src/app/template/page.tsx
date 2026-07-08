"use client";

import { useEffect, useState } from "react";

export default function TemplatePage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/template")
      .then((res) => res.json())
      .then((data) => {
        setSubject(data.subject ?? "");
        setBody(data.body ?? "");
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    setSaving(false);
    setSaved(true);
  }

  if (loading) {
    return <div className="p-8 text-zinc-600 dark:text-zinc-400">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← voltar ao dashboard
        </a>

        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Template de mensagem
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Variáveis disponíveis: <code>{"{{empresa}}"}</code>,{" "}
          <code>{"{{categoria}}"}</code>, <code>{"{{cidade}}"}</code>
        </p>

        <label className="mt-6 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Assunto
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />

        <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Corpo da mensagem
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {saving ? "Salvando..." : "Salvar template"}
        </button>
        {saved && (
          <span className="ml-3 text-sm text-green-600 dark:text-green-400">Salvo!</span>
        )}
      </div>
    </div>
  );
}
