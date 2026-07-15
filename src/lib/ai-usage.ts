import { supabase } from "./supabase";
import { startOfTodayBrasiliaISO } from "./timezone";

// Preco do Haiku 4.5 (o modelo usado em whatsapp-ai.ts): $1/$5 por milhao de
// tokens de entrada/saida. Se o modelo mudar em whatsapp-ai.ts, atualiza aqui
// tambem - nao ha como buscar isso dinamicamente da API.
const INPUT_PRICE_PER_MTOK = 1;
const OUTPUT_PRICE_PER_MTOK = 5;

export async function logAiUsage(inputTokens: number, outputTokens: number): Promise<void> {
  await supabase.from("ai_usage_log").insert({
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
}

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_PRICE_PER_MTOK +
    (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MTOK
  );
}

export interface AiUsageStats {
  callsToday: number;
  callsThisMonth: number;
  costTodayUsd: number;
  costThisMonthUsd: number;
}

function startOfMonthISO(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getAiUsageStats(): Promise<AiUsageStats> {
  const todayStart = startOfTodayBrasiliaISO();
  const monthStart = startOfMonthISO();

  const { data: todayRows } = await supabase
    .from("ai_usage_log")
    .select("input_tokens, output_tokens")
    .gte("created_at", todayStart);

  const { data: monthRows } = await supabase
    .from("ai_usage_log")
    .select("input_tokens, output_tokens")
    .gte("created_at", monthStart);

  const costToday = (todayRows ?? []).reduce(
    (sum, r) => sum + estimateCostUsd(r.input_tokens, r.output_tokens),
    0
  );
  const costMonth = (monthRows ?? []).reduce(
    (sum, r) => sum + estimateCostUsd(r.input_tokens, r.output_tokens),
    0
  );

  return {
    callsToday: (todayRows ?? []).length,
    callsThisMonth: (monthRows ?? []).length,
    costTodayUsd: costToday,
    costThisMonthUsd: costMonth,
  };
}
