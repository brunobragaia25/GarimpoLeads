import { countLeads, getLeadCategories, queryLeads, type LeadQuery } from "@/lib/leads";
import {
  buildProblemSummaryFor,
  categoryTemplateKey,
  getTemplate,
  getWhatsappNoSiteTemplate,
  renderTemplate,
} from "@/lib/template";
import { PageHeader } from "../PageHeader";
import { EmailQueueClient, type EmailQueueLead } from "./EmailQueueClient";
import { Mail } from "lucide-react";
import { getSelectedCountry } from "@/lib/country-server";
import { QueueFilters, type SiteFilter } from "../QueueFilters";

export const dynamic = "force-dynamic";

const QUEUE_BATCH_SIZE = 50;

export default async function EmailQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const categoryFilter = params.category ?? "all";
  const siteFilter: SiteFilter = params.site === "with" || params.site === "without" ? params.site : "all";
  const countryFilter = await getSelectedCountry();

  // Filtro e contagem no banco; so um lote vem pro app (recarregar traz o
  // proximo - quem ja foi marcado sai da lista).
  const queueQuery: LeadQuery = {
    country: countryFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    status: "not_contacted",
    site: siteFilter === "all" ? "" : siteFilter,
    hasEmail: true,
    noSiteFirst: true,
  };
  const [categories, totalPending, pending] = await Promise.all([
    getLeadCategories(countryFilter),
    countLeads(queueQuery),
    queryLeads(queueQuery, 0, QUEUE_BATCH_SIZE),
  ]);


  const noSiteTemplate = await getWhatsappNoSiteTemplate(countryFilter);
  const categoriesNeedingTemplate = [...new Set(pending.map((l) => l.category))];
  const templateByCategory = new Map(
    await Promise.all(categoriesNeedingTemplate.map(async (c) => [c, await getTemplate(categoryTemplateKey(c, countryFilter), countryFilter)] as const))
  );

  const queue: EmailQueueLead[] = pending.map((lead) => {
    // Sem site de verdade (nada ou so link de rede social): pitch de site
    // novo, em vez do texto que comenta o site existente.
    const noSite = !lead.website || lead.social_platform !== null;
    const template = noSite ? noSiteTemplate : templateByCategory.get(lead.category)!;
    const problem = buildProblemSummaryFor(countryFilter, {
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
      mapsUrl: lead.google_maps_url,
      subject: rendered.subject,
      body: rendered.body,
    };
  });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/email-queue" />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Fila de Email</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Um lead por vez: abra no seu email (ou copie), envie e marque. Sem site aparecem primeiro.
              </p>
            </div>
          </div>
          <QueueFilters basePath="/email-queue" site={siteFilter} category={categoryFilter} categories={categories} />
        </div>

        <EmailQueueClient leads={queue} total={totalPending} key={`${countryFilter}:${siteFilter}:${categoryFilter}`} />
      </main>
    </div>
  );
}
