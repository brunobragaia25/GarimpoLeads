import axios from "axios";
import { Lead } from "./types";
import { COUNTRIES, type Country } from "./countries";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Sem timeout, uma chamada travada na API do Google prende a funcao inteira
// do cron ate o limite de 300s da Vercel matar ela sem gravar o log final.
const REQUEST_TIMEOUT_MS = 15_000;

// A Places API (New) devolve telefone e site no proprio Text Search, entao nao
// precisa mais de uma chamada de Details por lead.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

// O Text Search devolve no maximo 20 por pagina e 3 paginas (60 no total).
// Com so a primeira pagina, cidades grandes ficavam com a maior parte dos
// negocios de fora.
const MAX_PAGES = 3;
// Pequena pausa antes de pedir a proxima pagina, pro token ja estar valido.
const PAGE_DELAY_MS = 1_500;

interface PlaceResult {
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
}

async function textSearch(
  query: string,
  language: string,
  pageToken?: string
): Promise<{ places: PlaceResult[]; nextPageToken?: string }> {
  try {
    const { data } = await axios.post(
      PLACES_SEARCH_URL,
      { textQuery: query, languageCode: language, ...(pageToken ? { pageToken } : {}) },
      {
        headers: {
          "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );
    return { places: data.places ?? [], nextPageToken: data.nextPageToken };
  } catch (err) {
    const apiError = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
    if (apiError) {
      throw new Error(`Places Text Search error: ${apiError.status} - ${apiError.message ?? ""}`);
    }
    throw err;
  }
}

export async function searchLeads(category: string, location: string, country: Country = "BR"): Promise<Lead[]> {
  const { placesLanguage: language, searchJoin } = COUNTRIES[country];
  const query = `${category} ${searchJoin} ${location}`;
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    if (page > 0) await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    const { places, nextPageToken } = await textSearch(query, language, pageToken);
    results.push(...places);
    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }

  return results.map((place) => ({
    name: place.displayName?.text ?? "",
    category,
    phone: place.nationalPhoneNumber,
    address: place.formattedAddress,
    website: place.websiteUri,
    google_maps_url: place.googleMapsUri,
    source: "google_maps" as const,
    country,
  }));
}
