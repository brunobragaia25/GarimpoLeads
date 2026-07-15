import { getUsageStats } from "@/lib/usage";
import { getWeeklyTrends } from "@/lib/trends";
import { PageHeader } from "../PageHeader";
import { Gauge, TrendingUp, Mail, Users, MailCheck, Bot } from "lucide-react";

function formatUsd(value: number): string {
  if (value < 0.01 && value > 0) return "< $0.01";
  return `$${value.toFixed(2)}`;
}

export const dynamic = "force-dynamic";

const HUNTER_MONTHLY_QUOTA = 50;
const SUPABASE_FREE_TIER_BYTES = 500 * 1024 * 1024; // 500MB

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Bar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function QuotaCard({
  title,
  used,
  total,
  suffix,
  note,
  displayUsed,
}: {
  title: string;
  used: number;
  total: number;
  suffix: string;
  note: string;
  displayUsed?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {displayUsed ?? used} / {suffix}
        </span>
      </div>
      <Bar used={used} total={total} />
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{note}</p>
    </div>
  );
}

function TrendChart({ trends }: { trends: Awaited<ReturnType<typeof getWeeklyTrends>> }) {
  const maxLeads = Math.max(1, ...trends.map((t) => t.leadsFound));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Tendência (últimas {trends.length} semanas)
        </span>
      </div>

      <div className="mt-5 flex items-end gap-2" style={{ height: "120px" }}>
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

      <div className="mt-6 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-900">
        {trends.map((t) => (
          <div key={t.weekStart} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-zinc-500 dark:text-zinc-400">{t.weekLabel}</span>
            <div className="h-2 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-2 rounded-full bg-purple-500"
                style={{ width: `${t.responseRate ?? 0}%` }}
              />
            </div>
            <span className="w-28 text-right text-zinc-500 dark:text-zinc-400">
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
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/usage" />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Uso e cotas
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Acompanhe o consumo das APIs e a tendência de resultados
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total de leads</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {stats.totalLeads}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <MailCheck className="h-4 w-4" />
              <span className="text-sm">Com email</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {stats.totalWithEmail}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <TrendChart trends={trends} />

          <QuotaCard
            title="Hunter.io (esse mês)"
            used={stats.hunterCallsThisMonth}
            total={HUNTER_MONTHLY_QUOTA}
            suffix={`~${HUNTER_MONTHLY_QUOTA}`}
            note="Só é usado quando a raspagem direta do site não encontra email (fallback)."
          />

          <QuotaCard
            title="Emails enviados hoje"
            used={stats.emailsSentToday}
            total={stats.dailyLimit}
            suffix={String(stats.dailyLimit)}
            note="Limite diário protege a reputação do domínio (configurável via SEND_DAILY_LIMIT)."
          />

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Mail className="h-4 w-4" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Emails enviados esse mês
              </span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {stats.emailsSentThisMonth}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Free tier do Resend: 3.000/mês, 100/dia.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Bot className="h-4 w-4" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                IA do WhatsApp (Claude Haiku)
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatUsd(stats.aiUsage.costTodayUsd)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  hoje · {stats.aiUsage.callsToday} resposta(s)
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatUsd(stats.aiUsage.costThisMonthUsd)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  esse mês · {stats.aiUsage.callsThisMonth} resposta(s)
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Estimativa baseada no preço do Haiku 4.5 ($1/$5 por milhão de tokens de
              entrada/saída) — não é a fatura oficial da Anthropic, só uma referência.
            </p>
          </div>

          {stats.databaseSizeBytes !== null && (
            <QuotaCard
              title="Banco de dados (Supabase)"
              used={stats.databaseSizeBytes}
              total={SUPABASE_FREE_TIER_BYTES}
              suffix="500 MB"
              displayUsed={formatBytes(stats.databaseSizeBytes)}
              note="Free tier do Supabase: 500MB de banco de dados."
            />
          )}
        </div>
      </main>
    </div>
  );
}
