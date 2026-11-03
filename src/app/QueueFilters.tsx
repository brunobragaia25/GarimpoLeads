"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import type { LeadLocation } from "@/lib/leads";

export type SiteFilter = "all" | "with" | "without";

export interface LocationFilter {
  state: string;
  city: string;
  neighborhood: string;
}

const NO_LOCATION: LocationFilter = { state: "", city: "", neighborhood: "" };

function buildHref(
  basePath: string,
  site: SiteFilter,
  category: string,
  starred: boolean,
  location: LocationFilter
): string {
  const params = new URLSearchParams();
  if (site !== "all") params.set("site", site);
  if (category !== "all") params.set("category", category);
  if (starred) params.set("starred", "1");
  if (location.state) params.set("state", location.state);
  if (location.city) params.set("city", location.city);
  if (location.neighborhood) params.set("neighborhood", location.neighborhood);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

const SELECT_CLASS =
  "h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300";

// Filtros das filas (WhatsApp e email): site + categoria + favoritos, na
// mesma altura. Estado/cidade/bairro so aparecem quando a pagina passa as
// opcoes (`locations`).
export function QueueFilters({
  basePath,
  site,
  category,
  categories,
  starred = false,
  starredCount = 0,
  location = NO_LOCATION,
  locations,
}: {
  basePath: string;
  site: SiteFilter;
  category: string;
  categories: string[];
  starred?: boolean;
  starredCount?: number;
  location?: LocationFilter;
  locations?: LeadLocation[];
}) {
  const router = useRouter();

  // Cada nivel so lista o que existe dentro do nivel acima ja escolhido.
  const states = locations ? [...new Set(locations.map((l) => l.state).filter(Boolean))] : [];
  const cities = locations
    ? [
        ...new Map(
          locations
            .filter((l) => !location.state || l.state === location.state)
            .map((l) => [`${l.state}|${l.city}`, l] as const)
        ).values(),
      ]
    : [];
  const neighborhoods =
    locations && location.city
      ? [
          ...new Set(
            locations
              .filter((l) => l.city === location.city && l.state === location.state && l.neighborhood)
              .map((l) => l.neighborhood)
          ),
        ]
      : [];

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
            href={buildHref(basePath, option.value, category, starred, location)}
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
        onChange={(e) => router.push(buildHref(basePath, site, e.target.value, starred, location))}
        className={SELECT_CLASS}
      >
        <option value="all">Todas as categorias</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {locations && states.length > 0 && (
        <select
          value={location.state}
          onChange={(e) =>
            router.push(buildHref(basePath, site, category, starred, { ...NO_LOCATION, state: e.target.value }))
          }
          className={SELECT_CLASS}
        >
          <option value="">Todos os estados</option>
          {states.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      )}

      {locations && cities.length > 0 && (
        <select
          // Valor leva o estado junto: escolher a cidade direto ja fixa o
          // estado dela (tem cidade com mesmo nome em estados diferentes).
          value={location.city ? `${location.state}|${location.city}` : ""}
          onChange={(e) => {
            const [state, city] = e.target.value ? e.target.value.split("|") : [location.state, ""];
            router.push(buildHref(basePath, site, category, starred, { state, city, neighborhood: "" }));
          }}
          className={`${SELECT_CLASS} max-w-48`}
        >
          <option value="">Todas as cidades</option>
          {cities.map((l) => (
            <option key={`${l.state}|${l.city}`} value={`${l.state}|${l.city}`}>
              {location.state || !l.state ? l.city : `${l.city} - ${l.state}`}
            </option>
          ))}
        </select>
      )}

      {neighborhoods.length > 0 && (
        <select
          value={location.neighborhood}
          onChange={(e) =>
            router.push(buildHref(basePath, site, category, starred, { ...location, neighborhood: e.target.value }))
          }
          className={`${SELECT_CLASS} max-w-48`}
        >
          <option value="">Todos os bairros</option>
          {neighborhoods.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}

      <Link
        href={buildHref(basePath, site, category, !starred, location)}
        title="Ver só os leads marcados como favoritos"
        className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
          starred
            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900"
        }`}
      >
        <Star className="h-4 w-4" fill={starred ? "currentColor" : "none"} />
        Só favoritos
        {starredCount > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none ${
              starred
                ? "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {starredCount}
          </span>
        )}
      </Link>
    </div>
  );
}
