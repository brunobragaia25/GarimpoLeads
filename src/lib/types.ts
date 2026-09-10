export type Country = "BR" | "US";

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
