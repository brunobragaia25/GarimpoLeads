"use client";

import { useEffect, useState } from "react";

const FOLLOWUP_CATEGORY = "__followup__";

export default function TemplatePage() {
  const [category, setCategory] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [configCategories, setConfigCategories] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    loadTemplate(category);

    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        const categories: string[] = data.categories ?? [];
        setConfigCategories(categories);

        fetch("/api/template?list=1")
          .then((res) => res.json())
          .then((templateData) => {
            const extra = (templateData.templates ?? [])
              .map((t: { category: string | null }) => t.category)
              .filter(
                (c: string | null): c is string =>
                  !!c && !categories.includes(c) && c !== FOLLOWUP_CATEGORY
              );
            setCustomCategories([...new Set(extra)] as string[]);
          });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadTemplate(cat: string) {
    setLoading(true);
    const url = cat ? `/api/template?category=${encodeURIComponent(cat)}` : "/api/template";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setSubject(data.subject ?? "");
        setBody(data.body ?? "");
        setLoading(false);
      });
  }

  function handleCategoryChange(newCategory: string) {
    setCategory(newCategory);
    setSaved(false);
    loadTemplate(newCategory);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, category: category || null }),
    });
    setSaving(false);
    setSaved(true);
  }

  const allCategories = [...configCategories, ...customCategories];

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
          Categoria
        </label>
        <select
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="">Padrão (todas as categorias)</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={FOLLOWUP_CATEGORY}>Follow-up (acompanhamento automático)</option>
        </select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {category === FOLLOWUP_CATEGORY
            ? "Enviado automaticamente pra quem foi contatado há 5+ dias e não recebeu follow-up ainda. Se não configurar, usa um texto padrão simples."
            : 'Se uma categoria não tiver template próprio, usa o "Padrão" na hora de enviar.'}
        </p>

        {loading ? (
          <p className="mt-6 text-zinc-600 dark:text-zinc-400">Carregando...</p>
        ) : (
          <>
            <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
          </>
        )}
      </div>
    </div>
  );
}
