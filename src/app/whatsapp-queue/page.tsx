import { countLeads, getLeadCategories, queryLeads, type LeadQuery } from "@/lib/leads";
import {
  buildProblemSummaryFor,
  categoryTemplateKey,
  getTemplate,
  getWhatsappNoSiteTemplate,
  renderTemplate,
} from "@/lib/template";
import { whatsappLink } from "@/lib/phone";
import { PageHeader } from "../PageHeader";
import { QueueClient, type QueueLead } from "./QueueClient";
import { QueueFilters, type SiteFilter } from "../QueueFilters";
import { MessageCircle } from "lucide-react";
import { getSelectedCountry } from "@/lib/country-server";

export const dynamic = "force-dynamic";

const QUEUE_BATCH_SIZE = 50;

export default async function WhatsappQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const siteFilter: SiteFilter =
    params.site === "with" || params.site === "without" ? params.site : "all";
  const categoryFilter = params.category ?? "all";
  const countryFilter = await getSelectedCountry();

  // Fica de fora da fila quem só tem link de rede social (Instagram,
  // LinkedIn, Facebook, Linktree) no campo "site" - não é um site de
  // verdade, então não vale gastar tempo manual nesses. País sempre
  // filtrado - nunca mistura BR e EUA na mesma fila. Filtro, contagem e
  // ordem (sem site primeiro) rodam no banco; só o lote vem pro app.
  const queueQuery: LeadQuery = {
    country: countryFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    status: "not_contacted",
    site: siteFilter === "all" ? "" : siteFilter,
    hasEmail: false,
    usablePhoneOnly: true,
    excludeSocial: true,
    noSiteFirst: true,
  };

  // So um lote vai pro navegador (montar a mensagem de todos os elegiveis
  // gerava ~4MB de HTML); recarregar a pagina traz o proximo.
  const [categories, totalPending, pending, whatsappTemplate] = await Promise.all([
    getLeadCategories(countryFilter),
    countLeads(queueQuery),
    queryLeads(queueQuery, 0, QUEUE_BATCH_SIZE),
    getWhatsappNoSiteTemplate(countryFilter),
  ]);


  const categoriesNeedingDefaultTemplate = [
    ...new Set(pending.filter((l) => l.website).map((l) => l.category)),
  ];
  const defaultTemplateByCategory = new Map(
    await Promise.all(
      categoriesNeedingDefaultTemplate.map(
        async (c) => [c, await getTemplate(categoryTemplateKey(c, countryFilter), countryFilter)] as const
      )
    )
  );

  const queue: QueueLead[] = pending
    .map((lead) => {
      const template = lead.website
        ? defaultTemplateByCategory.get(lead.category)
        : whatsappTemplate;
      if (!template) return null;

      const message = renderTemplate(template, {
        name: lead.name,
        category: lead.category,
        address: lead.address,
        problem: buildProblemSummaryFor(countryFilter, {
          performance_score: lead.performance_score,
          is_slow: lead.is_slow,
          is_outdated: lead.is_outdated,
          is_wordpress: lead.is_wordpress,
          is_broken: lead.is_broken,
          broken_reason: lead.broken_reason,
          notes: lead.site_notes,
      ps_mobile_score: lead.ps_mobile_score,
      ps_lcp_ms: lead.ps_lcp_ms,
        }),
      }).body;

      const waLink = whatsappLink(lead.phone, lead.country, message);
      if (!waLink) return null;

      return {
        id: lead.id,
        name: lead.name,
        category: lead.category,
        address: lead.address,
        phone: lead.phone!,
        website: lead.website,
        mapsUrl: lead.google_maps_url,
        waLink,
        message,
      };
    })
    .filter((l): l is QueueLead => l !== null);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/whatsapp-queue" />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Fila de WhatsApp</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Um lead por vez: abra o WhatsApp, envie e marque. Sem site aparecem primeiro.
              </p>
            </div>
          </div>

          <QueueFilters basePath="/whatsapp-queue" site={siteFilter} category={categoryFilter} categories={categories} />
        </div>

        <QueueClient leads={queue} total={totalPending} key={`${countryFilter}:${siteFilter}:${categoryFilter}`} />
      </main>
    </div>
  );
}
