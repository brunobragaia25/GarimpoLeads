import { supabase } from "./supabase";
import { normalizePhone } from "./deduplication";

// Telefones que nunca mais podem ser contatados, mesmo que o lead que os
// trouxe seja excluído e o mesmo negócio reapareça num scraping futuro
// (dedup normal de leads compara só contra quem ainda existe na tabela
// `leads`, então um lead excluído virava invisível pro dedup).
export async function blockPhone(phone: string | null | undefined, reason = "deleted_by_user"): Promise<void> {
  const normalized = normalizePhone(phone);
  if (!normalized) return;

  await supabase.from("blocked_contacts").upsert({ phone: normalized, reason }, { onConflict: "phone" });
}

export async function fetchBlockedPhones(): Promise<Set<string>> {
  const { data, error } = await supabase.from("blocked_contacts").select("phone");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.phone));
}
