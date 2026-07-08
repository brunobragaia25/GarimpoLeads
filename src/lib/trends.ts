import { supabase } from "./supabase";

const RESPONDED_OR_BEYOND = [
  "responded",
  "meeting_scheduled",
  "proposal_sent",
  "closed_won",
  "closed_lost",
];

export interface WeeklyTrend {
  weekLabel: string;
  weekStart: string;
  leadsFound: number;
  emailsSent: number;
  contactedCount: number;
  respondedCount: number;
  responseRate: number | null;
}

function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // volta pra segunda-feira
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${fmt(weekStart)}-${fmt(end)}`;
}

export async function getWeeklyTrends(weeksBack = 8): Promise<WeeklyTrend[]> {
  const now = new Date();
  const earliestWeekStart = getWeekStart(now);
  earliestWeekStart.setUTCDate(earliestWeekStart.getUTCDate() - (weeksBack - 1) * 7);

  const buckets = new Map<string, WeeklyTrend>();
  for (let i = 0; i < weeksBack; i++) {
    const weekStart = new Date(earliestWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() + i * 7);
    const key = weekStart.toISOString().slice(0, 10);
    buckets.set(key, {
      weekLabel: formatWeekLabel(weekStart),
      weekStart: key,
      leadsFound: 0,
      emailsSent: 0,
      contactedCount: 0,
      respondedCount: 0,
      responseRate: null,
    });
  }

  const { data: logs } = await supabase
    .from("execution_logs")
    .select("ran_at, leads_found")
    .gte("ran_at", earliestWeekStart.toISOString());

  for (const log of logs ?? []) {
    const key = getWeekStart(new Date(log.ran_at)).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.leadsFound += log.leads_found ?? 0;
  }

  const { data: outreach } = await supabase
    .from("outreach")
    .select("contacted_at, follow_up_sent_at, status")
    .gte("contacted_at", earliestWeekStart.toISOString());

  for (const row of outreach ?? []) {
    if (!row.contacted_at) continue;
    const key = getWeekStart(new Date(row.contacted_at)).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;

    bucket.emailsSent += 1;
    bucket.contactedCount += 1;
    if (row.status && RESPONDED_OR_BEYOND.includes(row.status)) {
      bucket.respondedCount += 1;
    }
  }

  const result = Array.from(buckets.values());
  for (const bucket of result) {
    bucket.responseRate =
      bucket.contactedCount > 0
        ? Math.round((bucket.respondedCount / bucket.contactedCount) * 100)
        : null;
  }

  return result;
}
