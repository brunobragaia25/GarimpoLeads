import { supabase } from "./supabase";

const WHATSAPP_SENDING_PAUSED_KEY = "whatsapp_sending_paused";

export async function isWhatsappSendingPaused(): Promise<boolean> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", WHATSAPP_SENDING_PAUSED_KEY)
    .maybeSingle();
  return data?.value === "true";
}

export async function setWhatsappSendingPaused(paused: boolean): Promise<void> {
  await supabase
    .from("app_settings")
    .upsert(
      { key: WHATSAPP_SENDING_PAUSED_KEY, value: String(paused), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
}

// Foco temporario da prospeccao: enquanto `until` nao passou, a rotacao
// diaria do pais usa SO estas categorias (ex: uma semana so de B2B). Depois
// da data volta sozinho pra lista normal, sem precisar desligar na mao.
export interface ProspectionFocus {
  categories: string[];
  until: string; // ISO
  // Marcas de aviso ja enviado no Telegram, pra nao repetir a cada cron.
  warned?: boolean;
  expiredNotified?: boolean;
}

const focusKey = (country: string) => `prospection_focus_${country}`;

export async function getProspectionFocus(country: string): Promise<ProspectionFocus | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", focusKey(country))
    .maybeSingle();
  if (!data?.value) return null;
  try {
    const focus = JSON.parse(data.value) as ProspectionFocus;
    if (!Array.isArray(focus.categories) || focus.categories.length === 0) return null;
    return focus;
  } catch {
    return null;
  }
}

export async function getActiveProspectionFocus(country: string): Promise<ProspectionFocus | null> {
  const focus = await getProspectionFocus(country);
  return focus && new Date(focus.until).getTime() > Date.now() ? focus : null;
}

export async function saveProspectionFocus(country: string, focus: ProspectionFocus | null): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert(
    { key: focusKey(country), value: focus ? JSON.stringify(focus) : "", updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

const DAY_MS = 86_400_000;

/**
 * Mensagens de aviso (Telegram) sobre o foco do pais: "falta 1 dia" e "acabou".
 * Cada aviso sai uma vez so - a marca fica gravada junto do foco.
 */
export async function takeFocusNotices(country: string): Promise<string[]> {
  const focus = await getProspectionFocus(country);
  if (!focus) return [];
  const msLeft = new Date(focus.until).getTime() - Date.now();
  const list = focus.categories.join(", ");

  if (msLeft <= 0) {
    if (focus.expiredNotified) return [];
    await saveProspectionFocus(country, { ...focus, expiredNotified: true });
    return [`🏁 GarimpoLeads (${country}): o foco temporário acabou e a prospecção voltou pra lista normal.\nEra: ${list}`];
  }
  if (msLeft <= DAY_MS && !focus.warned) {
    await saveProspectionFocus(country, { ...focus, warned: true });
    return [`⏳ GarimpoLeads (${country}): o foco temporário acaba em menos de 1 dia (${new Date(focus.until).toLocaleDateString("pt-BR")}).\nCategorias: ${list}`];
  }
  return [];
}
