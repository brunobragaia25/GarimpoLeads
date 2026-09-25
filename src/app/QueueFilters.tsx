"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export type SiteFilter = "all" | "with" | "without";

function buildHref(basePath: string, site: SiteFilter, category: string): string {
  const params = new URLSearchParams();
  if (site !== "all") params.set("site", site);
  if (category !== "all") params.set("category", category);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

// Filtros das filas (WhatsApp e email): site + categoria, na mesma altura.
export function QueueFilters({
  basePath,
  site,
  category,
  categories,
}: {
  basePath: string;
  site: SiteFilter;
  category: string;
  categories: string[];
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex h-10 items-center rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
        {(
          [
            { value: "all", label: "Todos" },
            { value: "without", label: "Sem site" },
            { value: "with", label: "Com site" },
          ] as const
        ).map((option) => (
          <Link
            key={option.value}
            href={buildHref(basePath, option.value, category)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              site === option.value
                ? "bg-emerald-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <select
        value={category}
        onChange={(e) => router.push(buildHref(basePath, site, e.target.value))}
        className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
      >
        <option value="all">Todas as categorias</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
