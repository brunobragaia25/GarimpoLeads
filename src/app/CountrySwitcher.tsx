"use client";

import { useSyncExternalStore } from "react";
import type { Country } from "@/lib/types";
import { COUNTRY_COOKIE, parseCountry } from "@/lib/country";
import { COUNTRIES, COUNTRY_CODES } from "@/lib/countries";

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
    <div className="grid grid-cols-4 gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
      {COUNTRY_CODES.map((code) => {
        const { flag, shortName, name } = COUNTRIES[code];
        return (
          <button
            key={code}
            title={name}
            onClick={() => code !== country && selectCountry(code)}
            className={`flex flex-col items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
              country === code
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            <span className="text-base leading-none">{flag}</span>
            {shortName}
          </button>
        );
      })}
    </div>
  );
}
