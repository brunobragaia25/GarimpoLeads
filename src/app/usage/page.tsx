import { getUsageStats } from "@/lib/usage";

export const dynamic = "force-dynamic";

const HUNTER_MONTHLY_QUOTA = 50;

function Bar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mt-1 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function UsagePage() {
  const stats = await getUsageStats();

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← voltar ao dashboard
        </a>

        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Uso e cotas
        </h1>

        <div className="mt-6 space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Hunter.io (esse mês)
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {stats.hunterCallsThisMonth} / ~{HUNTER_MONTHLY_QUOTA}
              </span>
            </div>
            <Bar used={stats.hunterCallsThisMonth} total={HUNTER_MONTHLY_QUOTA} />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Só é usado quando a raspagem direta do site não encontra email (fallback).
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Emails enviados hoje
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {stats.emailsSentToday} / {stats.dailyLimit}
              </span>
            </div>
            <Bar used={stats.emailsSentToday} total={stats.dailyLimit} />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Limite diário protege a reputação do domínio (configurável via SEND_DAILY_LIMIT).
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Emails enviados esse mês
            </span>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {stats.emailsSentThisMonth}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Free tier do Resend: 3.000/mês, 100/dia.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Total de leads</span>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {stats.totalLeads}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Com email</span>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {stats.totalWithEmail}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
