export type { Country } from "./countries";
import type { Country } from "./countries";

export interface Lead {
  id?: string;
  name: string;
  category: string;
  phone?: string;
  address?: string;
  website?: string;
  google_maps_url?: string;
  source: string;
  country?: Country;
  created_at?: string;
}
