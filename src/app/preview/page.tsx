import { AlertTriangle, CheckCircle2, Eye, XCircle } from "lucide-react";
import { PageHeader } from "../PageHeader";
import { getSelectedCountry } from "@/lib/country-server";
import { COUNTRIES } from "@/lib/countries";
import { previewPendingOutreach } from "@/lib/send-outreach";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SHOWCASE_SIZE = 12;

export default async function PreviewPage() {
  const country = await getSelectedCountry();
  const [previews, pendingCount] = await Promise.all([
    previewPendingOutreach(country, SHOWCASE_SIZE),
    supabase
      .from("outreach")
      .select("id, leads!inner(country, website)", { count: "exact", head: true })
      .eq("status", "pending")
      .not("email", "is", null)
      .not("leads.website", "is", null)
      .eq("leads.country", country)
      .then((r) => r.count ?? 0),
  ]);

  const blocked = previews.filter((p) => p.blocking.length > 0).length;
  const withWarnings = previews.filter((p) => p.blocking.length === 0 && p.warnings.length > 0).length;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/preview" />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Prévia do envio automático</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {COUNTRIES[country].flag} {COUNTRIES[country].name}: os próximos e-mails que o cron mandaria, exatamente
              como sairiam. Nada é enviado daqui.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
            <strong>{pendingCount}</strong> na fila do automático
          </span>
          <span
            className={`rounded-lg border px-3 py-1.5 ${
              blocked > 0
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
            }`}
          >
            {blocked > 0 ? `${blocked} seriam barrados pela checagem` : "nenhum barrado pela checagem"}
          </span>
          {withWarnings > 0 && (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
              {withWarnings} com aviso
            </span>
          )}
        </div>

        {previews.length === 0 ? (
          <p className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            Nenhum e-mail pendente no automático para {COUNTRIES[country].name} agora.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {previews.map((p) => {
              const isBlocked = p.blocking.length > 0;
              return (
                <article
                  key={p.outreachId}
                  className={`overflow-hidden rounded-xl border bg-white dark:bg-zinc-950 ${
                    isBlocked
                      ? "border-red-300 dark:border-red-900"
                      : p.warnings.length > 0
                        ? "border-amber-300 dark:border-amber-900"
                        : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{p.leadName}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {p.category} · para {p.to}
                      </p>
                    </div>
                    {isBlocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                        <XCircle className="h-3.5 w-3.5" />
                        seria barrado
                      </span>
                    ) : p.warnings.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        aviso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        ok
                      </span>
                    )}
                  </header>
                  {(isBlocked || p.warnings.length > 0) && (
                    <ul className="border-b border-zinc-200 bg-zinc-50 px-5 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                      {p.blocking.map((b) => (
                        <li key={b} className="text-red-600 dark:text-red-400">
                          Barra o envio: {b}
                        </li>
                      ))}
                      {p.warnings.map((w) => (
                        <li key={w} className="text-amber-600 dark:text-amber-400">
                          Aviso: {w}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="px-5 py-4">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Assunto: {p.subject}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {p.body}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
