import { Lead } from "./types";

export function deduplicateLeads(leads: Lead[]): Lead[] {
  const seen = new Set<string>();
  const deduped: Lead[] = [];

  for (const lead of leads) {
    const key = `${lead.name.trim().toLowerCase()}|${lead.address?.trim().toLowerCase() ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(lead);
    }
  }

  return deduped;
}
