"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, XCircle } from "lucide-react";
import { Select, type SelectGroup } from "./ui/Select";
import { DatePicker } from "./ui/DatePicker";

const STATUS_GROUPS: SelectGroup[] = [
  { options: [{ value: "all", label: "Todos" }] },
  {
    label: "Situação do e-mail",
    options: [
      { value: "no_email", label: "Sem e-mail" },
      { value: "not_contacted", label: "Ainda não enviados" },
      { value: "pending", label: "Na fila de envio (com e-mail)" },
      { value: "contacted", label: "Enviado" },
    ],
  },
  {
    label: "Com problema",
    options: [
      { value: "unsubscribed", label: "Descadastrado" },
      { value: "bounced", label: "E-mail inválido (bounce)" },
      { value: "ignored", label: "Ignorado" },
    ],
  },
  {
    label: "Andamento da venda",
    options: [
      { value: "responded", label: "Respondeu" },
      { value: "meeting_scheduled", label: "Reunião marcada" },
      { value: "proposal_sent", label: "Proposta enviada" },
      { value: "closed_won", label: "Fechado (ganho)" },
      { value: "closed_lost", label: "Fechado (perdido)" },
    ],
  },
];

const SITE_GROUPS: SelectGroup[] = [
  {
    options: [
      { value: "", label: "Todos" },
      { value: "with", label: "Com site" },
      { value: "without", label: "Sem site" },
      { value: "broken", label: "Site fora do ar/expirado" },
    ],
  },
];

export function FilterForm({
  categories,
  category,
  status,
  siteFilter,
  sentDate,
  search,
  priorityOnly,
  hasActiveFilters,
}: {
  categories: string[];
  category: string;
  status: string;
  siteFilter: string;
  sentDate: string;
  search: string;
  priorityOnly: boolean;
  hasActiveFilters: boolean;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("search", value), 500);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Categoria
          </label>
          <Select
            value={category}
            groups={[{ options: [{ value: "", label: "Todas" }, ...categories.map((c) => ({ value: c, label: c }))] }]}
            onChange={(v) => updateParam("category", v)}
          />
        </div>

        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Status
          </label>
          <Select value={status} groups={STATUS_GROUPS} onChange={(v) => updateParam("status", v)} />
        </div>

        <div className="min-w-[130px]">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Site
          </label>
          <Select value={siteFilter} groups={SITE_GROUPS} onChange={(v) => updateParam("site", v)} />
        </div>

        <div className="min-w-[150px]">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Data de envio
          </label>
          <DatePicker value={sentDate} onChange={(v) => updateParam("sentDate", v)} />
        </div>

        <div className="min-w-[200px] flex-[2]">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Buscar por nome
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Nome do lead..."
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
        <button
          type="button"
          role="switch"
          aria-checked={priorityOnly}
          onClick={() => updateParam("priority", priorityOnly ? "" : "1")}
          className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300"
        >
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              priorityOnly ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                priorityOnly ? "left-[18px]" : "left-0.5"
              }`}
            />
          </span>
          Só prioritários
        </button>

        {hasActiveFilters && (
          <a
            href="/"
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <XCircle className="h-4 w-4" />
            Limpar filtros
          </a>
        )}
      </div>
    </div>
  );
}
