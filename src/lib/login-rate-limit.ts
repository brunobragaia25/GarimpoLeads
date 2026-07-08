import { supabase } from "./supabase";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface LockStatus {
  locked: boolean;
  retryAfterSeconds?: number;
}

export async function checkLock(ip: string): Promise<LockStatus> {
  const { data } = await supabase
    .from("login_attempts")
    .select("locked_until")
    .eq("ip", ip)
    .maybeSingle();

  if (!data?.locked_until) return { locked: false };

  const lockedUntil = new Date(data.locked_until).getTime();
  const now = Date.now();

  if (lockedUntil > now) {
    return { locked: true, retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000) };
  }

  return { locked: false };
}

export async function recordFailedAttempt(ip: string): Promise<void> {
  const { data: existing } = await supabase
    .from("login_attempts")
    .select("failed_count")
    .eq("ip", ip)
    .maybeSingle();

  const newCount = (existing?.failed_count ?? 0) + 1;
  const lockedUntil =
    newCount >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null;

  await supabase
    .from("login_attempts")
    .upsert({ ip, failed_count: newCount, locked_until: lockedUntil }, { onConflict: "ip" });
}

export async function resetAttempts(ip: string): Promise<void> {
  await supabase
    .from("login_attempts")
    .upsert({ ip, failed_count: 0, locked_until: null }, { onConflict: "ip" });
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() ?? "unknown";
}
