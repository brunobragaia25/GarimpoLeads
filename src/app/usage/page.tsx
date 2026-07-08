import { getUsageStats } from "@/lib/usage";
import { getWeeklyTrends } from "@/lib/trends";

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

function TrendChart({ trends }: { trends: Awaited<ReturnType<typeof getWeeklyTrends>> }) {
  const maxLeads = Math.max(1, ...trends.map((t) => t.leadsFound));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Tendência (últimas {trends.length} semanas)
      </span>

      <div className="mt-4 flex items-end gap-2" style={{ height: "120px" }}>
        {trends.map((t) => (
          <div key={t.weekStart} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {t.leadsFound}
            </span>
            <div
              className="w-full rounded-t bg-emerald-400 dark:bg-emerald-600"
              style={{
                height: `${Math.max(2, (t.leadsFound / maxLeads) * 90)}px`,
              }}
            />
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
              {t.weekLabel}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Leads encontrados por semana</p>

      <div className="mt-6 space-y-2">
        {trends.map((t) => (
          <div key={t.weekStart} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-zinc-500 dark:text-zinc-400">{t.weekLabel}</span>
            <div className="h-2 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-2 rounded-full bg-purple-500"
                style={{ width: `${t.responseRate ?? 0}%` }}
              />
            </div>
            <span className="w-24 text-right text-zinc-500 dark:text-zinc-400">
              {t.responseRate !== null
                ? `${t.responseRate}% (${t.respondedCount}/${t.contactedCount})`
                : "sem envios"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Taxa de resposta por semana (de quem foi contatado naquela semana, quantos já
        responderam ou avançaram no pipeline até hoje)
      </p>
    </div>
  );
}

export default async function UsagePage() {
  const stats = await getUsageStats();
  const trends = await getWeeklyTrends(8);

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
          <TrendChart trends={trends} />

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
