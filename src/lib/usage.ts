import { supabase } from "./supabase";
import { startOfTodayBrasiliaISO } from "./timezone";

function startOfMonthISO(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export interface UsageStats {
  hunterCallsThisMonth: number;
  emailsSentThisMonth: number;
  emailsSentToday: number;
  dailyLimit: number;
  totalLeads: number;
  totalWithEmail: number;
  databaseSizeBytes: number | null;
}

export async function getUsageStats(): Promise<UsageStats> {
  const monthStart = startOfMonthISO();
  const todayStart = startOfTodayBrasiliaISO();

  const { count: hunterCalls } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .ilike("notes", "%hunter_domain_search%")
    .gte("created_at", monthStart);

  const { count: contactedThisMonth } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .gte("contacted_at", monthStart);

  const { count: followUpsThisMonth } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .gte("follow_up_sent_at", monthStart);

  const { count: contactedToday } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .gte("contacted_at", todayStart);

  const { count: followUpsToday } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .gte("follow_up_sent_at", todayStart);

  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { count: totalWithEmail } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null);

  const { data: dbSize } = await supabase.rpc("get_database_size");

  return {
    hunterCallsThisMonth: hunterCalls ?? 0,
    emailsSentThisMonth: (contactedThisMonth ?? 0) + (followUpsThisMonth ?? 0),
    emailsSentToday: (contactedToday ?? 0) + (followUpsToday ?? 0),
    dailyLimit: Number(process.env.SEND_DAILY_LIMIT) || 30,
    totalLeads: totalLeads ?? 0,
    totalWithEmail: totalWithEmail ?? 0,
    databaseSizeBytes: dbSize ?? null,
  };
}
