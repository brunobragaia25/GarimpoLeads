"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import { MessageSquareText, Save, Check, Info } from "lucide-react";

const FOLLOWUP_CATEGORY = "__followup__";
const WHATSAPP_NO_SITE_CATEGORY = "__whatsapp_no_site__";

type Country = "BR" | "US";

export default function TemplatePage() {
  const [country, setCountry] = useState<Country>("BR");
  const [category, setCategory] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [categoriesByCountry, setCategoriesByCountry] = useState<Record<Country, string[]>>({
    BR: [],
    US: [],
  });

  useEffect(() => {
    loadTemplate(category);

    Promise.all([
      fetch("/api/config?country=BR").then((res) => res.json()),
      fetch("/api/config?country=US").then((res) => res.json()),
      fetch("/api/template?list=1").then((res) => res.json()),
    ]).then(([brConfig, usConfig, templateData]) => {
      const brCategories: string[] = brConfig.categories ?? [];
      const usCategories: string[] = usConfig.categories ?? [];

      // Categoria com template proprio que nao esta em nenhuma config (ex:
      // categoria removida da config depois de ja ter template) - cai no
      // BR por padrao, ja que e o caso mais comum hoje.
      const known = new Set([...brCategories, ...usCategories]);
      const extra = (templateData.templates ?? [])
        .map((t: { category: string | null }) => t.category)
        .filter(
          (c: string | null): c is string =>
            !!c && !known.has(c) && c !== FOLLOWUP_CATEGORY && c !== WHATSAPP_NO_SITE_CATEGORY
        );

      setCategoriesByCountry({
        BR: [...new Set([...brCategories, ...extra])] as string[],
        US: [...new Set(usCategories)] as string[],
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

  function handleCountryChange(newCountry: Country) {
    setCountry(newCountry);
    handleCategoryChange("");
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

  const allCategories = categoriesByCountry[country];

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
            <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900">{"{{cidade}}"}</code>,{" "}
            <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900">{"{{problema}}"}</code>{" "}
            <span className="text-blue-700 dark:text-blue-400">(achado real da análise do site, ex: &quot;o carregamento tá bem lento&quot;)</span>
          </span>
        </div>

        <div className="mt-4 inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
          {(
            [
              { value: "BR", label: "🇧🇷 Brasil" },
              { value: "US", label: "🇺🇸 EUA" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => handleCountryChange(option.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                country === option.value
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
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
            {country === "BR" && (
              <>
                <option value={FOLLOWUP_CATEGORY}>Follow-up (acompanhamento automático)</option>
                <option value={WHATSAPP_NO_SITE_CATEGORY}>WhatsApp (leads sem site)</option>
              </>
            )}
          </select>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {category === FOLLOWUP_CATEGORY
              ? "Enviado automaticamente pra quem foi contatado há 5+ dias e não recebeu follow-up ainda. Se não configurar, usa um texto padrão simples."
              : category === WHATSAPP_NO_SITE_CATEGORY
                ? "Texto que já vem preenchido ao clicar no botão de WhatsApp de um lead sem site, no dashboard."
                : category === "" && country === "US"
                  ? 'O "Padrão" é compartilhado com o Brasil (hoje em português) - toda categoria dos EUA já tem template próprio em inglês, então normalmente não é usado.'
                  : 'Se uma categoria não tiver template próprio, usa o "Padrão" na hora de enviar.'}
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
          ) : (
            <>
              {category !== WHATSAPP_NO_SITE_CATEGORY && (
                <>
                  <label className="mt-5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Assunto
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </>
              )}

              <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {category === WHATSAPP_NO_SITE_CATEGORY ? "Mensagem do WhatsApp" : "Corpo da mensagem"}
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
