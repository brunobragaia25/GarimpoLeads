import Link from "next/link";
import { getLeadsWithDetails } from "@/lib/leads";
import { buildProblemSummary, getTemplate, getWhatsappNoSiteTemplate, renderTemplate } from "@/lib/template";
import { hasUsablePhone, whatsappLink } from "@/lib/phone";
import { PageHeader } from "../PageHeader";
import { QueueClient, type QueueLead } from "./QueueClient";
import { MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

type SiteFilter = "all" | "with" | "without";

export default async function WhatsappQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const siteFilter: SiteFilter =
    params.site === "with" || params.site === "without" ? params.site : "all";

  const allLeads = await getLeadsWithDetails();
  const whatsappTemplate = await getWhatsappNoSiteTemplate();

  // Fica de fora da fila quem só tem link de rede social (Instagram,
  // LinkedIn, Facebook, Linktree) no campo "site" - não é um site de
  // verdade, então não vale gastar tempo manual nesses; quem não tem site
  // nenhum ou tem site de verdade continua entrando normalmente.
  const pending = allLeads.filter(
    (l) =>
      !l.email &&
      hasUsablePhone(l.phone) &&
      (!l.outreach_status || l.outreach_status === "pending") &&
      l.social_platform === null &&
      (siteFilter === "all" || (siteFilter === "with" ? !!l.website : !l.website))
  );

  const categoriesNeedingDefaultTemplate = [
    ...new Set(pending.filter((l) => l.website).map((l) => l.category)),
  ];
  const defaultTemplateByCategory = new Map(
    await Promise.all(
      categoriesNeedingDefaultTemplate.map(
        async (c) => [c, await getTemplate(c)] as const
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
        problem: buildProblemSummary({
          performance_score: lead.performance_score,
          is_slow: lead.is_slow,
          is_outdated: lead.is_outdated,
          is_wordpress: lead.is_wordpress,
          notes: lead.site_notes,
        }),
      }).body;

      const waLink = whatsappLink(lead.phone, message);
      if (!waLink) return null;

      return {
        id: lead.id,
        name: lead.name,
        category: lead.category,
        address: lead.address,
        phone: lead.phone!,
        website: lead.website,
        waLink,
        message,
      };
    })
    .filter((l): l is QueueLead => l !== null);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/whatsapp-queue" />

      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Fila de WhatsApp
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Envie manualmente, um por um, sem precisar caçar cada lead no dashboard
            </p>
          </div>
        </div>

        <div className="mt-4 inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
          {(
            [
              { value: "all", label: "Todos" },
              { value: "without", label: "Sem site" },
              { value: "with", label: "Com site" },
            ] as const
          ).map((option) => (
            <Link
              key={option.value}
              href={option.value === "all" ? "/whatsapp-queue" : `/whatsapp-queue?site=${option.value}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                siteFilter === option.value
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <QueueClient leads={queue} key={siteFilter} />
      </main>
    </div>
  );
}
