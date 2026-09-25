import {
  countLeads,
  getLeadCategories,
  getLeadStats,
  isPriorityProspect,
  computeLeadScore,
  queryLeads,
  type EmailFilter,
  type LeadQuery,
} from "@/lib/leads";
import { SendOutreachButton } from "./SendOutreachButton";
import { LeadsTableBody, type LeadRow } from "./LeadsTableBody";
import { PageHeader } from "./PageHeader";
import { FilterForm } from "./FilterForm";
import {
  buildProblemSummary,
  buildProblemSummaryEN,
  getTemplate,
  getWhatsappNoSiteTemplate,
  renderTemplate,
} from "@/lib/template";
import { hasUsablePhone, isMobilePhone, whatsappLink } from "@/lib/phone";
import { getSelectedCountry } from "@/lib/country-server";
import {
  Users,
  Flame,
  MailCheck,
  Download,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  type LucideIcon,
} from "lucide-react";

type SortField = "created_at" | "score" | "name" | "category" | "performance" | "phone";
type SortDir = "asc" | "desc";

const PIPELINE_STATUSES = [
  "pending",
  "contacted",
  "responded",
  "meeting_scheduled",
  "proposal_sent",
  "closed_won",
  "closed_lost",
];


export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  const delta = 1;
  const pages: (number | "...")[] = [1];

  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("...");
  if (total > 1) pages.push(total);

  return pages;
}

function SortableHeader({
  field,
  label,
  currentField,
  currentDir,
  baseParams,
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDir: SortDir;
  baseParams: Record<string, string | undefined>;
}) {
  const isActive = currentField === field;
  const newDir: SortDir = isActive && currentDir === "desc" ? "asc" : "desc";
  const Icon = isActive ? (currentDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <a
      href={buildQuery({ ...baseParams, sortField: field, sortDir: newDir })}
      className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-zinc-900 dark:hover:text-zinc-50 ${
        isActive ? "text-zinc-900 dark:text-zinc-50" : ""
      }`}
    >
      {label}
      <Icon className={`h-3 w-3 ${isActive ? "" : "opacity-40"}`} />
    </a>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  href?: string;
  accent: string;
}) {
  const content = (
    <div className="flex h-full flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-zinc-500 dark:text-zinc-400">{label}</p>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-semibold leading-none text-zinc-900 dark:text-zinc-50">
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );

  return href ? (
    <a href={href} className="block h-full">
      {content}
    </a>
  ) : (
    content
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const countryFilter = await getSelectedCountry();
  const category = params.category ?? "";
  const status = (params.status as EmailFilter) ?? "all";
  const search = (params.search ?? "").trim().toLowerCase();
  const priorityOnly = params.priority === "1";
  const siteFilter = params.site ?? "";
  const sentDate = params.sentDate ?? "";
  const sortField: SortField = (
    ["score", "name", "category", "performance", "phone", "created_at"].includes(
      params.sortField ?? ""
    )
      ? params.sortField
      : "created_at"
  ) as SortField;
  const sortDir: SortDir = params.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // Filtro, ordenacao, paginacao e contagem rodam no banco (view
  // lead_overview) - o app so recebe os 25 leads da pagina.
  const leadQuery: LeadQuery = {
    country: countryFilter,
    category: category || undefined,
    status,
    search: search || undefined,
    priorityOnly,
    site: siteFilter === "with" || siteFilter === "without" || siteFilter === "broken" ? siteFilter : "",
    sentDate: sentDate || undefined,
    sortField,
    sortDir,
  };

  // Contagem e pagina pedidas juntas; so se a pagina nao existir mais (ex:
  // filtro reduziu os resultados) busca de novo a ultima.
  const [statsByCountry, categories, filteredCount, requestedItems, whatsappTemplate] = await Promise.all([
    getLeadStats(),
    getLeadCategories(countryFilter),
    countLeads(leadQuery),
    queryLeads(leadQuery, (page - 1) * PAGE_SIZE, PAGE_SIZE),
    getWhatsappNoSiteTemplate(countryFilter),
  ]);

  const stats = statsByCountry[countryFilter];
  const prospects = stats.prospects;
  const withEmail = stats.with_email;
  const pendingToSend = stats.pending_to_send;
  const notContacted = stats.not_contacted;
  const emailContacted = stats.email_contacted;
  // Conta tanto a marcacao manual antiga (lead sem email marcado
  // "contacted" - fluxo pre-automacao) quanto o envio automatico real
  // (whatsapp_conversations.template_sent_at) - ver view lead_stats.
  const whatsappContacted = stats.whatsapp_contacted;

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems =
    currentPage === page
      ? requestedItems
      : await queryLeads(leadQuery, (currentPage - 1) * PAGE_SIZE, PAGE_SIZE);

  // Leads sem email mas com site usam o mesmo template padrão do email
  // (por categoria) como texto do WhatsApp, em vez do template de "sem site".
  const categoriesNeedingDefaultTemplate = [
    ...new Set(
      pageItems.filter((l) => !l.email && l.website).map((l) => l.category)
    ),
  ];
  const defaultTemplateByCategory = new Map(
    await Promise.all(
      categoriesNeedingDefaultTemplate.map(
        async (c) => [c, await getTemplate(c, countryFilter)] as const
      )
    )
  );

  const rows: LeadRow[] = pageItems.map((lead) => {
    const summary = (countryFilter === "US" ? buildProblemSummaryEN : buildProblemSummary)({
      performance_score: lead.performance_score,
      is_slow: lead.is_slow,
      is_outdated: lead.is_outdated,
      is_wordpress: lead.is_wordpress,
      is_broken: lead.is_broken,
      broken_reason: lead.broken_reason,
      notes: lead.site_notes,
    });
    const needsWhatsapp = !lead.email;
    const templateForWhatsapp =
      !lead.website || lead.social_platform ? whatsappTemplate : defaultTemplateByCategory.get(lead.category);
    const waText =
      needsWhatsapp && templateForWhatsapp
        ? renderTemplate(templateForWhatsapp, {
            name: lead.name,
            category: lead.category,
            address: lead.address,
            problem: summary,
          }).body
        : undefined;
    const waLink = needsWhatsapp && hasUsablePhone(lead.phone) ? whatsappLink(lead.phone, lead.country, waText) : null;
    const hasPipelineStatus = !!lead.outreach_status && PIPELINE_STATUSES.includes(lead.outreach_status);
    return {
      lead,
      score: computeLeadScore(lead),
      isPriority: isPriorityProspect(lead),
      isLandline: !!lead.phone && !isMobilePhone(lead.phone),
      waLink,
      // Lead sem email nao tem envio automatico (contato e na mao pelo
      // WhatsApp), entao libera o funil manual pra quem tem WhatsApp.
      showPipeline: hasPipelineStatus || !!waLink,
      pipelineStatus: hasPipelineStatus ? lead.outreach_status! : "pending",
      problem: summary,
    };
  });

  const baseParams = {
    category,
    status,
    search,
    priority: priorityOnly ? "1" : undefined,
    site: siteFilter || undefined,
    sentDate: sentDate || undefined,
    sortField: sortField !== "created_at" ? sortField : undefined,
    sortDir: sortDir !== "desc" ? sortDir : undefined,
  };

  const hasActiveFilters =
    category || status !== "all" || search || priorityOnly || siteFilter || sentDate;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/" />

      <main className="px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {countryFilter === "US" ? "🇺🇸 Leads dos EUA" : "🇧🇷 Leads do Brasil"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/export${buildQuery(baseParams)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </a>
            <SendOutreachButton pendingCount={pendingToSend} />
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={Users}
            label="leads no total"
            value={stats.total}
            accent="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
          />
          <StatCard
            icon={Flame}
            label="prospects prioritários"
            value={prospects}
            href={buildQuery({ ...baseParams, priority: "1" })}
            accent="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
          />
          <StatCard
            icon={MailCheck}
            label="com email encontrado"
            value={withEmail}
            accent="bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400"
          />
          <StatCard
            icon={Clock}
            label="não enviados ainda"
            value={notContacted}
            href={buildQuery({ ...baseParams, status: "not_contacted" })}
            accent="bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
          />
          <StatCard
            icon={CheckCircle2}
            label="enviados por email"
            value={emailContacted}
            accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          />
          <StatCard
            icon={MessageCircle}
            label="contatados por WhatsApp"
            value={whatsappContacted}
            accent="bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
          />
        </div>

        {/* Filters */}
        <FilterForm
          categories={categories}
          category={category}
          status={status}
          siteFilter={siteFilter}
          sentDate={sentDate}
          search={search}
          priorityOnly={priorityOnly}
          hasActiveFilters={!!hasActiveFilters}
        />

        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {filteredCount} resultado(s) &middot; página {currentPage} de {totalPages}
        </p>

        {/* Table */}
        <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-28" />
              <col />
              <col className="w-48" />
              <col className="w-40" />
              <col className="w-48" />
            </colgroup>
            <thead>
              <tr className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="whitespace-nowrap py-3 pl-9 pr-2">
                  <SortableHeader field="score" label="Score" currentField={sortField} currentDir={sortDir} baseParams={baseParams} />
                </th>
                <th className="whitespace-nowrap px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <SortableHeader field="name" label="Empresa" currentField={sortField} currentDir={sortDir} baseParams={baseParams} />
                    <span className="text-zinc-300 dark:text-zinc-700">/</span>
                    <SortableHeader field="category" label="Categoria" currentField={sortField} currentDir={sortDir} baseParams={baseParams} />
                  </span>
                </th>
                <th className="whitespace-nowrap px-4 py-3">
                  <SortableHeader field="phone" label="Telefone" currentField={sortField} currentDir={sortDir} baseParams={baseParams} />
                </th>
                <th className="whitespace-nowrap px-4 py-3">
                  <SortableHeader field="performance" label="Site" currentField={sortField} currentDir={sortDir} baseParams={baseParams} />
                </th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
              </tr>
            </thead>
            <LeadsTableBody rows={rows} />
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-sm">
            <a
              href={
                currentPage > 1 ? buildQuery({ ...baseParams, page: "1" }) : "#"
              }
              title="Primeira página"
              className={`inline-flex items-center rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 ${
                currentPage <= 1
                  ? "pointer-events-none opacity-40"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              <ChevronsLeft className="h-4 w-4" />
            </a>
            <a
              href={
                currentPage > 1
                  ? buildQuery({ ...baseParams, page: String(currentPage - 1) })
                  : "#"
              }
              className={`inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 ${
                currentPage <= 1
                  ? "pointer-events-none opacity-40"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </a>

            {getPageNumbers(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-zinc-400 dark:text-zinc-600">
                  …
                </span>
              ) : (
                <a
                  key={p}
                  href={buildQuery({ ...baseParams, page: String(p) })}
                  className={`inline-flex min-w-[36px] items-center justify-center rounded-lg border px-2.5 py-1.5 ${
                    p === currentPage
                      ? "border-emerald-600 bg-emerald-600 font-semibold text-white dark:border-emerald-500 dark:bg-emerald-500"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  {p}
                </a>
              )
            )}

            <a
              href={
                currentPage < totalPages
                  ? buildQuery({ ...baseParams, page: String(currentPage + 1) })
                  : "#"
              }
              className={`inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 ${
                currentPage >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href={
                currentPage < totalPages
                  ? buildQuery({ ...baseParams, page: String(totalPages) })
                  : "#"
              }
              title="Última página"
              className={`inline-flex items-center rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 ${
                currentPage >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              <ChevronsRight className="h-4 w-4" />
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
