import { supabase } from "./supabase";
import { getGestaoDevzFirestore } from "./firebase-admin";

export interface HealthCheckResult {
  name: string;
  ok: boolean;
  message: string;
}

async function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function checkSupabase(): Promise<HealthCheckResult> {
  try {
    const { error, count } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { name: "Supabase", ok: true, message: `Conectado (${count} leads)` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return { name: "Supabase", ok: false, message };
  }
}

async function checkGoogleMaps(): Promise<HealthCheckResult> {
  try {
    const res = await withTimeout(
      fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=teste&key=${process.env.GOOGLE_MAPS_API_KEY}`
      )
    );
    const data = await res.json();
    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      return { name: "Google Maps", ok: true, message: "Chave válida" };
    }
    return { name: "Google Maps", ok: false, message: `${data.status}: ${data.error_message ?? ""}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return { name: "Google Maps", ok: false, message };
  }
}

async function checkHunter(): Promise<HealthCheckResult> {
  try {
    const res = await withTimeout(
      fetch(`https://api.hunter.io/v2/account?api_key=${process.env.HUNTER_API_KEY}`)
    );
    const data = await res.json();
    if (res.ok) {
      const remaining = data?.data?.requests?.searches?.available ?? "?";
      return { name: "Hunter.io", ok: true, message: `Chave válida (${remaining} buscas restantes no mês)` };
    }
    return { name: "Hunter.io", ok: false, message: data?.errors?.[0]?.details ?? "chave inválida" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return { name: "Hunter.io", ok: false, message };
  }
}

async function checkResend(): Promise<HealthCheckResult> {
  try {
    const res = await withTimeout(
      fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      })
    );
    const data = await res.json();
    // Nossa chave é restrita a "sending access", então /domains sempre
    // retorna 401 com esse erro específico mesmo com chave válida - é o
    // sinal esperado de que a chave existe e está corretamente escopada.
    if (res.ok || data?.name === "restricted_api_key") {
      return { name: "Resend", ok: true, message: "Chave válida" };
    }
    return { name: "Resend", ok: false, message: data?.message ?? "chave inválida" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return { name: "Resend", ok: false, message };
  }
}

async function checkTelegram(): Promise<HealthCheckResult> {
  try {
    const res = await withTimeout(
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`)
    );
    const data = await res.json();
    if (data.ok) {
      return { name: "Telegram", ok: true, message: `Bot @${data.result?.username}` };
    }
    return { name: "Telegram", ok: false, message: data.description ?? "token inválido" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return { name: "Telegram", ok: false, message };
  }
}

async function checkGestaoDevz(): Promise<HealthCheckResult> {
  try {
    const db = getGestaoDevzFirestore();
    const uid = process.env.GESTAODEVZ_USER_UID!;
    const snap = await withTimeout(
      db.collection("users").doc(uid).collection("clients").limit(1).get()
    );
    return { name: "GestãoDevz (Firebase)", ok: true, message: `Conectado (${snap.size} lido de teste)` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return { name: "GestãoDevz (Firebase)", ok: false, message };
  }
}

export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  const results = await Promise.all([
    checkSupabase(),
    checkGoogleMaps(),
    checkHunter(),
    checkResend(),
    checkTelegram(),
    checkGestaoDevz(),
  ]);
  return results;
}
