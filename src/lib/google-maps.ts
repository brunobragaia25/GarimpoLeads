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
].join(",");

interface PlaceResult {
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
}

async function textSearch(query: string, language: string): Promise<PlaceResult[]> {
  try {
    const { data } = await axios.post(
      PLACES_SEARCH_URL,
      { textQuery: query, languageCode: language },
      {
        headers: {
          "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );
    return data.places ?? [];
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
  const results = await textSearch(query, language);

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
