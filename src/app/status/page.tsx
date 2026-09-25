import { runHealthChecks } from "@/lib/health-checks";
import { supabase } from "@/lib/supabase";
import { COUNTRIES, COUNTRY_CODES, type Country } from "@/lib/countries";
import { PageHeader } from "../PageHeader";
import { Activity, CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

interface CountryRun {
  leads_found: number;
  sent: number;
  failed: number;
  blocked: number;
  follow_ups: number;
}

interface RunRow {
  id: string;
  ran_at: string;
  leads_found: number;
  emails_found: number;
  emails_sent: number;
  follow_ups_sent: number;
  emails_failed: number;
  blocked_by_check: number;
  by_country: Record<Country, CountryRun> | null;
  errors: string | null;
  duration_ms: number | null;
}

async function getRecentRuns(): Promise<RunRow[]> {
  const { data } = await supabase
    .from("execution_logs")
    .select("id, ran_at, leads_found, emails_found, emails_sent, follow_ups_sent, emails_failed, blocked_by_check, by_country, errors, duration_ms")
    .order("ran_at", { ascending: false })
    .limit(14);
  return (data ?? []) as RunRow[];
}

function formatRunDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function RunsTable({ runs }: { runs: RunRow[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Últimas execuções do cron</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        E-mails enviados por país em cada disparo. Falhas e e-mails barrados pela checagem de qualidade aparecem em
        vermelho.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-2.5 font-medium">Quando</th>
              <th className="px-4 py-2.5 font-medium">Leads novos</th>
              <th className="px-4 py-2.5 font-medium">Enviados por país</th>
              <th className="px-4 py-2.5 font-medium">Problemas</th>
              <th className="px-4 py-2.5 font-medium">Duração</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-900 dark:bg-zinc-950">
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  Nenhuma execução registrada ainda.
                </td>
              </tr>
            )}
            {runs.map((run) => {
              const hasBreakdown = !!run.by_country;
              const realErrors = (run.errors ?? "")
                .split(" | ")
                .filter((e) => e && !e.includes("desativado manualmente"));
              const problems = run.emails_failed + run.blocked_by_check + realErrors.length;
              return (
                <tr key={run.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {formatRunDate(run.ran_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {run.leads_found}
                    <span className="text-zinc-400"> · {run.emails_found} e-mails</span>
                  </td>
                  <td className="px-4 py-3">
                    {hasBreakdown ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {COUNTRY_CODES.map((c) => {
                          const r = run.by_country![c];
                          if (!r) return null;
                          return (
                            <span
                              key={c}
                              title={`${COUNTRIES[c].name}: ${r.sent} enviados, ${r.follow_ups} follow-ups`}
                              className={`whitespace-nowrap ${
                                r.sent + r.follow_ups === 0 ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-200"
                              }`}
                            >
                              {COUNTRIES[c].flag} {r.sent}
                              {r.follow_ups > 0 && <span className="text-zinc-400"> +{r.follow_ups}</span>}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">sem detalhe (execução antiga)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {problems === 0 ? (
                      <span className="text-zinc-400">-</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        {[
                          run.emails_failed > 0 && `${run.emails_failed} falhas`,
                          run.blocked_by_check > 0 && `${run.blocked_by_check} barrados`,
                          ...realErrors.slice(0, 2).map((e) => e.slice(0, 60)),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {run.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function StatusPage() {
  const [results, runs] = await Promise.all([runHealthChecks(), getRecentRuns()]);
  const allOk = results.every((r) => r.ok);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/status" />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              allOk
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
            }`}
          >
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Status do sistema
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Testa a conexão real com cada serviço externo agora
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {results.map((r) => (
            <div
              key={r.name}
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                r.ok
                  ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
              }`}
            >
              {r.ok ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              )}
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{r.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.message}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-600">
          Atualiza a página pra rodar os testes de novo.
        </p>

        <RunsTable runs={runs} />
      </main>
    </div>
  );
}
