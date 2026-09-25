import { cookies } from "next/headers";
import type { Country } from "./types";
import { COUNTRY_COOKIE, parseCountry } from "./country";

export async function getSelectedCountry(): Promise<Country> {
  const store = await cookies();
  return parseCountry(store.get(COUNTRY_COOKIE)?.value);
}
