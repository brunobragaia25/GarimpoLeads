"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, XCircle } from "lucide-react";

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
          <select
            defaultValue={category}
            onChange={(e) => updateParam("category", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Status do email
          </label>
          <select
            defaultValue={status}
            onChange={(e) => updateParam("status", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="all">Todos</option>
            <option value="no_email">Sem email</option>
            <option value="not_contacted">Não enviados ainda</option>
            <option value="pending">Pendente de envio</option>
            <option value="contacted">Já enviado</option>
            <option value="ignored">Ignorado</option>
            <option value="unsubscribed">Descadastrado</option>
            <option value="bounced">Email inválido (bounce)</option>
            <option value="responded">Respondeu</option>
            <option value="meeting_scheduled">Reunião marcada</option>
            <option value="proposal_sent">Proposta enviada</option>
            <option value="closed_won">Fechado (ganho)</option>
            <option value="closed_lost">Fechado (perdido)</option>
          </select>
        </div>

        <div className="min-w-[130px]">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Site
          </label>
          <select
            defaultValue={siteFilter}
            onChange={(e) => updateParam("site", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Todos</option>
            <option value="with">Com site</option>
            <option value="without">Sem site</option>
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Data de envio
          </label>
          <input
            type="date"
            defaultValue={sentDate}
            onChange={(e) => updateParam("sentDate", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
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
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            defaultChecked={priorityOnly}
            onChange={(e) => updateParam("priority", e.target.checked ? "1" : "")}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700"
          />
          Só prioritários
        </label>

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
