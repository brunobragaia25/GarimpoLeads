import type { Country } from "./types";

// Pais selecionado vale pro app inteiro (dashboard, filas, configuracoes,
// template, export) - fica num cookie em vez de parametro de URL por tela.
export const COUNTRY_COOKIE = "garimpo_country";

export function parseCountry(value: string | null | undefined): Country {
  return value === "US" ? "US" : "BR";
}
