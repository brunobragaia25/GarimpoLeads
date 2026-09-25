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

// Normaliza telefone pra comparação (só dígitos); retorna null se curto
// demais pra ser um telefone real (evita falso-positivo em campos vazios).
// 9 digitos e o menor telefone valido entre os paises (Portugal).
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? digits : null;
}
