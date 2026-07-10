import { getLeadsWithDetails } from "@/lib/leads";
import { getTemplate, getWhatsappNoSiteTemplate, renderTemplate } from "@/lib/template";
import { isMobilePhone, whatsappLink } from "@/lib/phone";
import { PageHeader } from "../PageHeader";
import { QueueClient, type QueueLead } from "./QueueClient";
import { MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WhatsappQueuePage() {
  const allLeads = await getLeadsWithDetails();
  const whatsappTemplate = await getWhatsappNoSiteTemplate();

  const pending = allLeads.filter(
    (l) =>
      !l.email &&
      isMobilePhone(l.phone) &&
      (!l.outreach_status || l.outreach_status === "pending")
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
      }).body;

      const waLink = whatsappLink(lead.phone, message);
      if (!waLink) return null;

      return {
        id: lead.id,
        name: lead.name,
        category: lead.category,
        address: lead.address,
        phone: lead.phone!,
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

        <QueueClient leads={queue} />
      </main>
    </div>
  );
}
