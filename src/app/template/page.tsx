"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import { MessageSquareText, Save, Check, Info } from "lucide-react";

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
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/template" />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Template de mensagem
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              O texto que vai ser enviado pros seus leads
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Variáveis disponíveis: <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900">{"{{empresa}}"}</code>,{" "}
            <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900">{"{{categoria}}"}</code>,{" "}
            <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900">{"{{cidade}}"}</code>
          </span>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Categoria
          </label>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Padrão (todas as categorias)</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={FOLLOWUP_CATEGORY}>Follow-up (acompanhamento automático)</option>
          </select>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {category === FOLLOWUP_CATEGORY
              ? "Enviado automaticamente pra quem foi contatado há 5+ dias e não recebeu follow-up ainda. Se não configurar, usa um texto padrão simples."
              : 'Se uma categoria não tiver template próprio, usa o "Padrão" na hora de enviar.'}
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
          ) : (
            <>
              <label className="mt-5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Assunto
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />

              <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Corpo da mensagem
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar template"}
                </button>
                {saved && (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" />
                    Salvo!
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
