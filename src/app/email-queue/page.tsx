import Link from "next/link";
import { countLeads, getLeadCategories, queryLeads, type LeadQuery } from "@/lib/leads";
import {
  buildProblemSummary,
  buildProblemSummaryEN,
  getTemplate,
  getWhatsappNoSiteTemplate,
  renderTemplate,
} from "@/lib/template";
import { PageHeader } from "../PageHeader";
import { EmailQueueClient, type EmailQueueLead } from "./EmailQueueClient";
import { Mail } from "lucide-react";
import { getSelectedCountry } from "@/lib/country-server";

export const dynamic = "force-dynamic";

const QUEUE_BATCH_SIZE = 50;

function buildQueueHref({ category }: { category?: string }): string {
  const searchParams = new URLSearchParams();
  if (category) searchParams.set("category", category);
  const query = searchParams.toString();
  return query ? `/email-queue?${query}` : "/email-queue";
}

export default async function EmailQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const categoryFilter = params.category ?? "all";
  const countryFilter = await getSelectedCountry();

  // Filtro e contagem no banco; so um lote vem pro app (recarregar traz o
  // proximo - quem ja foi marcado sai da lista).
  const queueQuery: LeadQuery = {
    country: countryFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    status: "not_contacted",
    hasEmail: true,
  };
  const [categories, totalPending, pending] = await Promise.all([
    getLeadCategories(countryFilter),
    countLeads(queueQuery),
    queryLeads(queueQuery, 0, QUEUE_BATCH_SIZE),
  ]);


  const noSiteTemplate = await getWhatsappNoSiteTemplate(countryFilter);
  const categoriesNeedingTemplate = [...new Set(pending.map((l) => l.category))];
  const templateByCategory = new Map(
    await Promise.all(categoriesNeedingTemplate.map(async (c) => [c, await getTemplate(c, countryFilter)] as const))
  );

  const queue: EmailQueueLead[] = pending.map((lead) => {
    // Sem site de verdade (nada ou so link de rede social): pitch de site
    // novo, em vez do texto que comenta o site existente.
    const noSite = !lead.website || lead.social_platform !== null;
    const template = noSite ? noSiteTemplate : templateByCategory.get(lead.category)!;
    const problem = (countryFilter === "US" ? buildProblemSummaryEN : buildProblemSummary)({
      performance_score: lead.performance_score,
      is_slow: lead.is_slow,
      is_outdated: lead.is_outdated,
      is_wordpress: lead.is_wordpress,
      is_broken: lead.is_broken,
      broken_reason: lead.broken_reason,
      notes: lead.site_notes,
    });
    const rendered = renderTemplate(template, {
      name: lead.name,
      category: lead.category,
      address: lead.address,
      problem,
    });

    return {
      id: lead.id,
      name: lead.name,
      category: lead.category,
      address: lead.address,
      email: lead.email!,
      website: lead.website,
      subject: rendered.subject,
      body: rendered.body,
    };
  });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/email-queue" />

      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Fila de Email
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Copie o email e mande manualmente, um por um
            </p>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="mt-4">
            <CategoryFilter categories={categories} value={categoryFilter} />
          </div>
        )}

        <EmailQueueClient leads={queue} total={totalPending} key={`${countryFilter}:${categoryFilter}`} />
      </main>
    </div>
  );
}

function CategoryFilter({
  categories,
  value,
}: {
  categories: string[];
  value: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={buildQueueHref({})}
        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
          value === "all"
            ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
            : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
        }`}
      >
        Todas
      </Link>
      {categories.map((c) => (
        <Link
          key={c}
          href={buildQueueHref({ category: c })}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            value === c
              ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
          }`}
        >
          {c}
        </Link>
      ))}
    </div>
  );
}
