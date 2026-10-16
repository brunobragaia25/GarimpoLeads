"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import { Check, Loader2, MapPin, Plus, Save, SlidersHorizontal, Tag, X } from "lucide-react";
import { COUNTRIES, COUNTRY_CODES, type Country } from "@/lib/countries";

function Chip({
  label,
  onRemove,
  b2b,
  onToggleB2b,
}: {
  label: string;
  onRemove: () => void;
  b2b?: boolean;
  onToggleB2b?: () => void;
}) {
  return (
    <span className="group inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pl-3 pr-1.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {label}
      {onToggleB2b && (
        <button
          onClick={onToggleB2b}
          title={b2b ? "Usa a mensagem B2B (clique pra desmarcar)" : "Marcar como B2B (usa a mensagem B2B)"}
          className={`rounded-full px-1.5 text-[10px] font-semibold leading-4 transition-colors ${
            b2b
              ? "bg-sky-600 text-white"
              : "hidden text-zinc-400 group-hover:inline hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-950 dark:hover:text-sky-300"
          }`}
        >
          B2B
        </button>
      )}
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

// Estado com muitas cidades (ex: Flórida inteira) vira um chip so, pra nao
// ocupar a tela toda. No banco continua a lista de cidades normal.
const STATE_GROUP_MIN = 15;
const STATE_NAMES: Record<string, string> = { FL: "Flórida" };

function stateOf(city: string): string | null {
  return city.match(/, ([A-Z]{2})$/)?.[1] ?? null;
}

function GroupChip({
  label,
  cities,
  onRemove,
}: {
  label: string;
  cities: string[];
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          {label} · estado inteiro ({cities.length} cidades)
        </span>
        <span className="flex items-center gap-3 text-xs">
          <button onClick={() => setOpen(!open)} className="text-emerald-700 hover:underline dark:text-emerald-400">
            {open ? "Ocultar cidades" : "Ver cidades"}
          </button>
          <button
            onClick={() => window.confirm(`Remover ${cities.length} cidades de ${label}?`) && onRemove()}
            className="text-red-600 hover:underline dark:text-red-400"
          >
            Remover estado
          </button>
        </span>
      </div>
      {open && (
        <p className="mt-2 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-200/70">
          {cities.map((c) => c.replace(/, [A-Z]{2}$/, "")).join(" · ")}
        </p>
      )}
    </div>
  );
}

function ListEditor({
  title,
  icon: Icon,
  items,
  placeholder,
  onChange,
  groupByState = false,
  b2b,
  onToggleB2b,
}: {
  title: string;
  icon: typeof Tag;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
  groupByState?: boolean;
  b2b?: string[];
  onToggleB2b?: (item: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const stateCounts = new Map<string, string[]>();
  if (groupByState) {
    for (const item of items) {
      const st = stateOf(item);
      if (st) stateCounts.set(st, [...(stateCounts.get(st) ?? []), item]);
    }
  }
  const groups = [...stateCounts.entries()].filter(([, list]) => list.length >= STATE_GROUP_MIN);
  const groupedStates = new Set(groups.map(([st]) => st));
  const looseItems = items.filter((item) => {
    const st = stateOf(item);
    return !(st && groupedStates.has(st));
  });

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
        {groups.map(([st, list]) => (
          <GroupChip
            key={st}
            label={STATE_NAMES[st] ?? st}
            cities={list}
            onRemove={() => onChange(items.filter((x) => stateOf(x) !== st))}
          />
        ))}
        {looseItems.map((item) => (
          <Chip
            key={item}
            label={item}
            onRemove={() => onChange(items.filter((x) => x !== item))}
            b2b={b2b?.includes(item)}
            onToggleB2b={onToggleB2b && (() => onToggleB2b(item))}
          />
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
  BRUS: { category: "Nova categoria (ex: padaria brasileira)", city: "Nova cidade (ex: Atlanta, GA)" },
};

function CountryCard({ country }: { country: Country }) {
  const { flag, name } = COUNTRIES[country];
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Foco temporario: null = desligado (nao mexe), senao categorias + dias.
  const [focusCategories, setFocusCategories] = useState<string[]>([]);
  const [focusUntil, setFocusUntil] = useState<string | null>(null);
  const [focusDays, setFocusDays] = useState(7);
  const [focusChanged, setFocusChanged] = useState(false);
  // Categorias marcadas como B2B (usam o template B2B).
  const [b2b, setB2b] = useState<string[]>([]);
  const [focusOpen, setFocusOpen] = useState(false);

  function toggleB2b(item: string) {
    setB2b((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
    setDirty(true);
    setSaved(false);
  }

  useEffect(() => {
    fetch(`/api/config?country=${country}`)
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        setCities(data.cities ?? []);
        setFocusCategories(data.focus?.categories ?? []);
        setB2b(data.b2b ?? []);
        setFocusUntil(data.focus?.until ?? null);
        // O contador mostra os dias que FALTAM, entao baixa sozinho a cada dia.
        if (data.focus?.until) {
          setFocusDays(Math.max(1, Math.ceil((new Date(data.focus.until).getTime() - Date.now()) / 86_400_000)));
        }
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
      body: JSON.stringify({
        country,
        categories,
        cities,
        b2b,
        ...(focusChanged && {
          focus:
            focusCategories.length > 0
              ? { categories: focusCategories, until: focusUntil ?? new Date(Date.now() + focusDays * 86_400_000).toISOString() }
              : null,
        }),
      }),
    });
    setFocusChanged(false);
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
            b2b={b2b}
            onToggleB2b={toggleB2b}
          />
          <ListEditor
            title="Cidades"
            icon={MapPin}
            items={cities}
            placeholder={PLACEHOLDERS[country].city}
            onChange={update(setCities)}
            groupByState={country === "BRUS" || country === "US"}
          />
          <div className="lg:col-span-2">
            {!focusOpen ? (
              <button
                onClick={() => setFocusOpen(true)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  focusUntil && focusCategories.length > 0
                    ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                    : "border-dashed border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                }`}
              >
                {focusUntil && focusCategories.length > 0
                  ? `Foco temporário ativo até ${new Date(focusUntil).toLocaleDateString("pt-BR")} · ${focusCategories.length} categorias · editar`
                  : "+ Foco temporário (usar só algumas categorias por um tempo)"}
              </button>
            ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20 lg:col-span-2">
            <ListEditor
              title="Foco temporário (substitui as categorias acima)"
              icon={Tag}
              items={focusCategories}
              placeholder="Ex: transportadoras; indústrias metalúrgicas"
              b2b={b2b}
              onToggleB2b={toggleB2b}
              onChange={(items) => {
                setFocusCategories(items);
                // Mexeu na lista: recomeca a contagem dos dias a partir de hoje.
                setFocusUntil(null);
                setFocusChanged(true);
                setDirty(true);
                setSaved(false);
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <label className="inline-flex items-center gap-2">
                Durante
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={focusDays}
                  onChange={(e) => {
                    setFocusDays(Math.max(1, Number(e.target.value) || 1));
                    setFocusUntil(null);
                    setFocusChanged(true);
                    setDirty(true);
                    setSaved(false);
                  }}
                  className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                />
                {focusUntil ? "dias restantes" : "dias a partir de hoje"}
              </label>
              {focusUntil && focusCategories.length > 0 && (
                <span className="text-amber-700 dark:text-amber-400">
                  Ativo até {new Date(focusUntil).toLocaleDateString("pt-BR")} (faltam {focusDays} {focusDays === 1 ? "dia" : "dias"}); depois volta pra lista normal. Aviso no Telegram 1 dia antes e quando acabar.
                </span>
              )}
            </div>
          </div>
            )}
            {focusOpen && (
              <button onClick={() => setFocusOpen(false)} className="mt-2 text-xs text-zinc-500 hover:underline">
                Recolher
              </button>
            )}
          </div>
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
