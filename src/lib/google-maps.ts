import axios from "axios";
import { Lead } from "./types";

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

// Sem timeout, uma chamada travada na API do Google prende a funcao inteira
// do cron ate o limite de 300s da Vercel matar ela sem gravar o log final.
const REQUEST_TIMEOUT_MS = 15_000;

interface TextSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
}

interface PlaceDetails {
  formatted_phone_number?: string;
  website?: string;
  url?: string;
}

async function textSearch(query: string): Promise<TextSearchResult[]> {
  const { data } = await axios.get(`${PLACES_BASE}/textsearch/json`, {
    params: {
      query,
      key: process.env.GOOGLE_MAPS_API_KEY,
      language: "pt-BR",
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Places Text Search error: ${data.status} - ${data.error_message ?? ""}`);
  }

  return data.results ?? [];
}

async function placeDetails(placeId: string): Promise<PlaceDetails> {
  const { data } = await axios.get(`${PLACES_BASE}/details/json`, {
    params: {
      place_id: placeId,
      fields: "formatted_phone_number,website,url",
      key: process.env.GOOGLE_MAPS_API_KEY,
      language: "pt-BR",
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  if (data.status !== "OK") {
    throw new Error(`Places Details error: ${data.status} - ${data.error_message ?? ""}`);
  }

  return data.result ?? {};
}

export async function searchLeads(category: string, location: string): Promise<Lead[]> {
  const results = await textSearch(`${category} em ${location}`);

  const leads: Lead[] = [];
  for (const result of results) {
    const details = await placeDetails(result.place_id);
    leads.push({
      name: result.name,
      category,
      phone: details.formatted_phone_number,
      address: result.formatted_address,
      website: details.website,
      google_maps_url: details.url,
      source: "google_maps",
    });
  }

  return leads;
}
