import { runHealthChecks } from "@/lib/health-checks";
import { PageHeader } from "../PageHeader";
import { Activity, CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const results = await runHealthChecks();
  const allOk = results.every((r) => r.ok);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/status" />

      <main className="mx-auto max-w-2xl px-6 py-8">
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
      </main>
    </div>
  );
}
