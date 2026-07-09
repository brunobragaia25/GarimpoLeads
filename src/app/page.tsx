import {
  getLeadsWithDetails,
  isPriorityProspect,
  matchesEmailFilter,
  computeLeadScore,
  toBrasiliaDateStr,
  type EmailFilter,
} from "@/lib/leads";
import { SendOutreachButton } from "./SendOutreachButton";
import { IgnoreButton, PipelineStageSelect, SendToCRMButton } from "./LeadActions";
import { PageHeader } from "./PageHeader";
import { getTemplate, getWhatsappNoSiteTemplate, renderTemplate } from "@/lib/template";
import {
  Users,
  Flame,
  MailCheck,
  Download,
  Phone,
  MessageCircle,
  Globe,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MessageSquare,
  Calendar,
  FileText,
  Trophy,
  XCircle,
  Ban,
  AlertTriangle,
  Eye,
  MousePointerClick,
  RotateCw,
  Clock,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  type LucideIcon,
} from "lucide-react";

type SortField = "created_at" | "score" | "name" | "category" | "performance";
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

const STATUS_BADGES: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  contacted: {
    label: "Enviado",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  responded: {
    label: "Respondeu",
    icon: MessageSquare,
    className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  },
  meeting_scheduled: {
    label: "Reunião marcada",
    icon: Calendar,
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  },
  proposal_sent: {
    label: "Proposta enviada",
    icon: FileText,
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400",
  },
  closed_won: {
    label: "Fechado (ganho)",
    icon: Trophy,
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  closed_lost: {
    label: "Fechado (perdido)",
    icon: XCircle,
    className: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  ignored: {
    label: "Ignorado",
    icon: Ban,
    className: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  unsubscribed: {
    label: "Descadastrado",
    icon: Ban,
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  bounced: {
    label: "Email inválido",
    icon: AlertTriangle,
    className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function whatsappLink(phone: string | null, prefilledText?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  const base = `https://wa.me/${withCountryCode}`;
  return prefilledText ? `${base}?text=${encodeURIComponent(prefilledText)}` : base;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
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
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
          {value}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      </div>
    </div>
  );

  return href ? (
    <a href={href} className="block">
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
  const category = params.category ?? "";
  const status = (params.status as EmailFilter) ?? "all";
  const search = (params.search ?? "").trim().toLowerCase();
  const priorityOnly = params.priority === "1";
  const siteFilter = params.site ?? "";
  const sentDate = params.sentDate ?? "";
  const sortField: SortField = (
    ["score", "name", "category", "performance", "created_at"].includes(
      params.sortField ?? ""
    )
      ? params.sortField
      : "created_at"
  ) as SortField;
  const sortDir: SortDir = params.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const allLeads = await getLeadsWithDetails();
  const whatsappTemplate = await getWhatsappNoSiteTemplate();

  const categories = [...new Set(allLeads.map((l) => l.category))].sort();

  const dirMultiplier = sortDir === "asc" ? 1 : -1;

  const filtered = allLeads
    .filter((lead) => {
      if (category && lead.category !== category) return false;
      if (!matchesEmailFilter(lead, status)) return false;
      if (search && !lead.name.toLowerCase().includes(search)) return false;
      if (priorityOnly && !isPriorityProspect(lead)) return false;
      if (siteFilter === "with" && !lead.website) return false;
      if (siteFilter === "without" && lead.website) return false;
      if (
        sentDate &&
        toBrasiliaDateStr(lead.contacted_at) !== sentDate &&
        toBrasiliaDateStr(lead.follow_up_sent_at) !== sentDate
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortField) {
        case "score":
          return (computeLeadScore(a) - computeLeadScore(b)) * dirMultiplier;
        case "name":
          return a.name.localeCompare(b.name) * dirMultiplier;
        case "category":
          return a.category.localeCompare(b.category) * dirMultiplier;
        case "performance": {
          const aVal = a.performance_score ?? -1;
          const bVal = b.performance_score ?? -1;
          return (aVal - bVal) * dirMultiplier;
        }
        default:
          return (
            (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
            dirMultiplier
          );
      }
    });

  const prospects = allLeads.filter(isPriorityProspect).length;
  const withEmail = allLeads.filter((l) => l.email).length;
  const pendingToSend = allLeads.filter(
    (l) => l.email && l.outreach_status === "pending"
  ).length;
  const contacted = allLeads.filter((l) => l.outreach_status === "contacted").length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

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
        async (c) => [c, await getTemplate(c)] as const
      )
    )
  );

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
        <div className="flex items-center justify-end">
          <a
            href={`/api/export${buildQuery(baseParams)}`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </a>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon={Users}
            label="leads no total"
            value={allLeads.length}
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
            icon={CheckCircle2}
            label="já enviados"
            value={contacted}
            accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          />
        </div>

        {/* Send button */}
        <div className="mt-4">
          <SendOutreachButton pendingCount={pendingToSend} />
        </div>

        {/* Filters */}
        <form
          method="GET"
          className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Categoria
              </label>
              <select
                name="category"
                defaultValue={category}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Status do email
              </label>
              <select
                name="status"
                defaultValue={status}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="all">Todos</option>
                <option value="no_email">Sem email</option>
                <option value="pending">Pendente de envio</option>
                <option value="contacted">Já enviado</option>
                <option value="ignored">Ignorado</option>
                <option value="unsubscribed">Descadastrado</option>
                <option value="bounced">Email inválido (bounce)</option>
                <option value="responded">Respondeu</option>
                <option value="meeting_scheduled">Reunião marcada</option>
                <option value="proposal_sent">Proposta enviada</option>
                <option value="closed_won">Fechado (ganho)</option>
                <option value="closed_lost">Fechado (perdido)</option>
              </select>
            </div>

            <div className="min-w-[130px]">
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Site
              </label>
              <select
                name="site"
                defaultValue={siteFilter}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">Todos</option>
                <option value="with">Com site</option>
                <option value="without">Sem site</option>
              </select>
            </div>

            <div className="min-w-[150px]">
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Data de envio
              </label>
              <input
                type="date"
                name="sentDate"
                defaultValue={sentDate}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>

            <input type="hidden" name="sortField" value={sortField} />
            <input type="hidden" name="sortDir" value={sortDir} />

            <div className="min-w-[200px] flex-[2]">
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Buscar por nome
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Nome do lead..."
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                name="priority"
                value="1"
                defaultChecked={priorityOnly}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700"
              />
              Só prioritários
            </label>

            <button
              type="submit"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Search className="h-4 w-4" />
              Filtrar
            </button>
            {hasActiveFilters && (
              <a
                href="/"
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              >
                <XCircle className="h-4 w-4" />
                Limpar filtros
              </a>
            )}
          </div>
        </form>

        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {filtered.length} resultado(s) &middot; página {currentPage} de {totalPages}
        </p>

        {/* Table */}
        <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="whitespace-nowrap px-4 py-3">
                  <SortableHeader field="score" label="Score" currentField={sortField} currentDir={sortDir} baseParams={baseParams} />
                </th>
                <th className="whitespace-nowrap px-4 py-3">
                  <SortableHeader field="name" label="Nome" currentField={sortField} currentDir={sortDir} baseParams={baseParams} />
                </th>
                <th className="whitespace-nowrap px-4 py-3">
                  <SortableHeader field="category" label="Categoria" currentField={sortField} currentDir={sortDir} baseParams={baseParams} />
                </th>
                <th className="whitespace-nowrap px-4 py-3">Telefone</th>
                <th className="whitespace-nowrap px-4 py-3">Site</th>
                <th className="whitespace-nowrap px-4 py-3">WordPress</th>
                <th className="whitespace-nowrap px-4 py-3">
                  <SortableHeader field="performance" label="Performance" currentField={sortField} currentDir={sortDir} baseParams={baseParams} />
                </th>
                <th className="whitespace-nowrap px-4 py-3">Email</th>
                <th className="whitespace-nowrap px-4 py-3">Status envio</th>
                <th className="whitespace-nowrap px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {pageItems.map((lead) => {
                const score = computeLeadScore(lead);
                const needsWhatsapp = !lead.email;
                const templateForWhatsapp = !lead.website
                  ? whatsappTemplate
                  : defaultTemplateByCategory.get(lead.category);
                const waText =
                  needsWhatsapp && templateForWhatsapp
                    ? renderTemplate(templateForWhatsapp, {
                        name: lead.name,
                        category: lead.category,
                        address: lead.address,
                      }).body
                    : undefined;
                const wa = needsWhatsapp ? whatsappLink(lead.phone, waText) : null;
                const hasPipelineStatus =
                  !!lead.outreach_status && PIPELINE_STATUSES.includes(lead.outreach_status);
                // Leads sem email não têm envio automático (é feito na mão
                // pelo WhatsApp), então liberamos o pipeline manualmente
                // pra quem tem um botão de WhatsApp disponível.
                const showPipeline = hasPipelineStatus || !!wa;
                const pipelineStatus = hasPipelineStatus ? lead.outreach_status! : "pending";

                return (
                  <tr
                    key={lead.id}
                    className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${
                      isPriorityProspect(lead) ? "bg-amber-50/60 dark:bg-amber-950/10" : "bg-white dark:bg-black"
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          score >= 80
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                            : score >= 40
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        <Flame className="h-3 w-3" />
                        {score}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {lead.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {lead.category}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        {lead.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-zinc-400" />
                            {lead.phone}
                          </span>
                        ) : (
                          "-"
                        )}
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          site
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <XCircle className="h-3.5 w-3.5" />
                          sem site
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {lead.is_wordpress === null ? "-" : lead.is_wordpress ? "sim" : "não"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {lead.performance_score ?? "-"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {lead.email ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {lead.outreach_status && STATUS_BADGES[lead.outreach_status] ? (
                          (() => {
                            const badge = STATUS_BADGES[lead.outreach_status];
                            const BadgeIcon = badge.icon;
                            return (
                              <span
                                className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                              >
                                <BadgeIcon className="h-3 w-3" />
                                {badge.label}
                                {lead.outreach_status === "contacted" &&
                                  ` · ${formatDate(lead.contacted_at)}`}
                              </span>
                            );
                          })()
                        ) : lead.email ? (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            Pendente
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600">-</span>
                        )}
                        {lead.follow_up_sent_at && (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                            <RotateCw className="h-3 w-3" />
                            Follow-up {formatDate(lead.follow_up_sent_at)}
                          </span>
                        )}
                        {lead.opened_at && (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            <Eye className="h-3 w-3" />
                            Abriu {formatDate(lead.opened_at)}
                          </span>
                        )}
                        {lead.clicked_at && (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-950 dark:text-pink-400">
                            <MousePointerClick className="h-3 w-3" />
                            Clicou {formatDate(lead.clicked_at)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {showPipeline && (
                          <PipelineStageSelect
                            leadId={lead.id}
                            currentStatus={pipelineStatus}
                          />
                        )}
                        {lead.outreach_status !== "ignored" && (
                          <IgnoreButton leadId={lead.id} />
                        )}
                        {lead.email && (
                          <SendToCRMButton
                            leadId={lead.id}
                            synced={!!lead.crm_synced_at}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
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
            <span className="px-2 text-zinc-500 dark:text-zinc-400">
              {currentPage} / {totalPages}
            </span>
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
          </div>
        )}
      </main>
    </div>
  );
}
