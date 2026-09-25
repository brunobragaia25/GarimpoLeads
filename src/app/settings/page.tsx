"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import { Check, Loader2, MapPin, Plus, Save, SlidersHorizontal, Tag, X } from "lucide-react";
import { COUNTRIES, COUNTRY_CODES, type Country } from "@/lib/countries";

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pl-3 pr-1.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {label}
      <button
        onClick={onRemove}
        title="Remover"
        className="flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ListEditor({
  title,
  icon: Icon,
  items,
  placeholder,
  onChange,
}: {
  title: string;
  icon: typeof Tag;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    // Aceita varios de uma vez separados por ";" ou quebra de linha.
    const next = draft
      .split(/[;\n]/)
      .map((s) => s.trim())
      .filter((s) => s && !items.includes(s));
    if (next.length > 0) onChange([...items, ...next]);
    setDraft("");
  }

  return (
    <div className="min-w-0">
      <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <Icon className="h-4 w-4" />
        {title}
        <span className="text-xs font-normal text-zinc-400">({items.length})</span>
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length === 0 && <p className="text-sm text-zinc-400">Nenhum ainda.</p>}
        {items.map((item) => (
          <Chip key={item} label={item} onRemove={() => onChange(items.filter((x) => x !== item))} />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </div>
    </div>
  );
}

const PLACEHOLDERS: Record<Country, { category: string; city: string }> = {
  BR: { category: "Nova categoria (ex: pet shops)", city: "Nova cidade (ex: Natal, RN)" },
  US: { category: "New category (ex: roofers)", city: "New city (ex: Tampa, FL)" },
  PT: { category: "Nova categoria (ex: ginásios)", city: "Nova cidade (ex: Aveiro)" },
  UK: { category: "New category (ex: roofers)", city: "New city (ex: Leeds)" },
};

function CountryCard({ country }: { country: Country }) {
  const { flag, name } = COUNTRIES[country];
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/config?country=${country}`)
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        setCities(data.cities ?? []);
        setLoading(false);
      });
  }, [country]);

  function update(setter: (items: string[]) => void) {
    return (items: string[]) => {
      setter(items);
      setDirty(true);
      setSaved(false);
    };
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, categories, cities }),
    });
    setSaving(false);
    setSaved(true);
    setDirty(false);
  }

  const active = categories.length > 0 && cities.length > 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{flag}</span>
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{name}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {loading
                ? "Carregando..."
                : active
                  ? `${categories.length} categorias × ${cities.length} cidades = ${categories.length * cities.length} combinações na rotação`
                  : "Fora da rotação: precisa de pelo menos uma categoria e uma cidade"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Salvo!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </header>

      {loading ? (
        <p className="px-6 py-6 text-sm text-zinc-500">Carregando...</p>
      ) : (
        <div className="grid gap-8 px-6 py-6 lg:grid-cols-2">
          <ListEditor
            title="Categorias"
            icon={Tag}
            items={categories}
            placeholder={PLACEHOLDERS[country].category}
            onChange={update(setCategories)}
          />
          <ListEditor
            title="Cidades"
            icon={MapPin}
            items={cities}
            placeholder={PLACEHOLDERS[country].city}
            onChange={update(setCities)}
          />
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/settings" />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Configurações do cron diário</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Categorias e cidades de cada país. O cron percorre todas as combinações aos poucos, dividindo o volume
              diário entre os países ativos.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {COUNTRY_CODES.map((country) => (
            <CountryCard key={country} country={country} />
          ))}
        </div>
      </main>
    </div>
  );
}
