import Link from "next/link";
import { getLeadsWithDetails } from "@/lib/leads";
import { buildProblemSummary, buildProblemSummaryEN, getTemplate, renderTemplate } from "@/lib/template";
import { PageHeader } from "../PageHeader";
import { EmailQueueClient, type EmailQueueLead } from "./EmailQueueClient";
import { Mail } from "lucide-react";
import type { Country } from "@/lib/types";

export const dynamic = "force-dynamic";

function buildQueueHref({ category, country }: { category?: string; country?: string }): string {
  const searchParams = new URLSearchParams();
  if (category) searchParams.set("category", category);
  if (country) searchParams.set("country", country);
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
  // Padrão EUA: hoje é o caso de uso principal dessa fila (no Brasil o
  // canal manual é WhatsApp - ver /whatsapp-queue).
  const countryFilter: Country = params.country === "BR" ? "BR" : "US";

  const allLeads = await getLeadsWithDetails();

  const brCount = allLeads.filter(
    (l) => l.country === "BR" && l.email && (!l.outreach_status || l.outreach_status === "pending")
  ).length;
  const usCount = allLeads.filter(
    (l) => l.country === "US" && l.email && (!l.outreach_status || l.outreach_status === "pending")
  ).length;

  const baseEligible = allLeads.filter(
    (l) =>
      !!l.email &&
      (!l.outreach_status || l.outreach_status === "pending") &&
      l.country === countryFilter
  );

  const categories = [...new Set(baseEligible.map((l) => l.category))].sort();

  const pending = baseEligible.filter(
    (l) => categoryFilter === "all" || l.category === categoryFilter
  );

  const categoriesNeedingTemplate = [...new Set(pending.map((l) => l.category))];
  const templateByCategory = new Map(
    await Promise.all(categoriesNeedingTemplate.map(async (c) => [c, await getTemplate(c)] as const))
  );

  const queue: EmailQueueLead[] = pending.map((lead) => {
    const template = templateByCategory.get(lead.category)!;
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

        <div className="mt-4 inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
          {(
            [
              { value: "BR", label: `🇧🇷 Brasil (${brCount})` },
              { value: "US", label: `🇺🇸 EUA (${usCount})` },
            ] as const
          ).map((option) => (
            <Link
              key={option.value}
              href={buildQueueHref({ country: option.value })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                countryFilter === option.value
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="mt-4">
            <CategoryFilter categories={categories} value={categoryFilter} countryFilter={countryFilter} />
          </div>
        )}

        <EmailQueueClient leads={queue} key={`${countryFilter}:${categoryFilter}`} />
      </main>
    </div>
  );
}

function CategoryFilter({
  categories,
  value,
  countryFilter,
}: {
  categories: string[];
  value: string;
  countryFilter: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={buildQueueHref({ country: countryFilter === "US" ? undefined : countryFilter })}
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
          href={buildQueueHref({ category: c, country: countryFilter === "US" ? undefined : countryFilter })}
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
