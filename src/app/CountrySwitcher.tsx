"use client";

import { useSyncExternalStore } from "react";
import type { Country } from "@/lib/types";
import { COUNTRY_COOKIE, parseCountry } from "@/lib/country";

function readCountryCookie(): Country {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([^;]*)`));
  return parseCountry(match?.[1]);
}

const noopSubscribe = () => () => {};

// Null no servidor (nao da pra ler document.cookie la); o valor real entra
// na hidratacao.
export function useSelectedCountry(): Country | null {
  return useSyncExternalStore(noopSubscribe, readCountryCookie, () => null);
}

function selectCountry(country: Country) {
  document.cookie = `${COUNTRY_COOKIE}=${country}; path=/; max-age=31536000; samesite=lax`;
  // Recarrega sem a query: categoria/filtro de um pais nao existe no outro.
  window.location.href = window.location.pathname;
}

export function CountrySwitcher() {
  const country = useSelectedCountry();

  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
      {(
        [
          { value: "BR", label: "🇧🇷 Brasil" },
          { value: "US", label: "🇺🇸 EUA" },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          onClick={() => option.value !== country && selectCountry(option.value)}
          className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
            country === option.value
              ? "bg-emerald-600 text-white"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
