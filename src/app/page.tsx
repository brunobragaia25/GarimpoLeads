import {
  getLeadsWithDetails,
  isPriorityProspect,
  matchesEmailFilter,
  computeLeadScore,
  type EmailFilter,
} from "@/lib/leads";
import { SendOutreachButton } from "./SendOutreachButton";
import { IgnoreButton, PipelineStageSelect } from "./LeadActions";

const PIPELINE_STATUSES = [
  "contacted",
  "responded",
  "meeting_scheduled",
  "proposal_sent",
  "closed_won",
  "closed_lost",
];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  contacted: {
    label: "✓ Enviado",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  responded: {
    label: "💬 Respondeu",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  },
  meeting_scheduled: {
    label: "📅 Reunião marcada",
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  },
  proposal_sent: {
    label: "📄 Proposta enviada",
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400",
  },
  closed_won: {
    label: "🎉 Fechado (ganho)",
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  closed_lost: {
    label: "Fechado (perdido)",
    className: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  ignored: {
    label: "Ignorado",
    className: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  unsubscribed: {
    label: "Descadastrado",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  bounced: {
    label: "Email inválido",
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
  });
}

function whatsappLink(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}`;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
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
  const sortBy = params.sort === "score" ? "score" : "recent";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const allLeads = await getLeadsWithDetails();

  const categories = [...new Set(allLeads.map((l) => l.category))].sort();

  const filtered = allLeads
    .filter((lead) => {
      if (category && lead.category !== category) return false;
      if (!matchesEmailFilter(lead, status)) return false;
      if (search && !lead.name.toLowerCase().includes(search)) return false;
      if (priorityOnly && !isPriorityProspect(lead)) return false;
      if (siteFilter === "with" && !lead.website) return false;
      if (siteFilter === "without" && lead.website) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "score") return computeLeadScore(b) - computeLeadScore(a);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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

  const baseParams = {
    category,
    status,
    search,
    priority: priorityOnly ? "1" : undefined,
    site: siteFilter || undefined,
    sort: sortBy === "score" ? "score" : undefined,
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            GarimpoLeads
          </h1>
          <div className="flex gap-4">
            <a
              href={`/api/export${buildQuery(baseParams)}`}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              exportar CSV
            </a>
            <a
              href="/template"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              editar template de mensagem
            </a>
            <a
              href="/usage"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              uso e cotas
            </a>
            <a
              href="/settings"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              configurações
            </a>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-6 text-sm text-zinc-600 dark:text-zinc-400">
          <span>{allLeads.length} leads no total</span>
          <a href={buildQuery({ ...baseParams, priority: "1" })} className="hover:underline">
            {prospects} prospects prioritários
          </a>
          <span>{withEmail} com email encontrado</span>
          <span>{contacted} já enviados</span>
        </div>

        <div className="mt-4">
          <SendOutreachButton pendingCount={pendingToSend} />
        </div>

        <form
          method="GET"
          className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Categoria
            </label>
            <select
              name="category"
              defaultValue={category}
              className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Status do email
            </label>
            <select
              name="status"
              defaultValue={status}
              className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Site
            </label>
            <select
              name="site"
              defaultValue={siteFilter}
              className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Todos</option>
              <option value="with">Com site</option>
              <option value="without">Sem site</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Buscar por nome
            </label>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Nome do lead..."
              className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Ordenar por
            </label>
            <select
              name="sort"
              defaultValue={sortBy}
              className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="recent">Mais recentes</option>
              <option value="score">Prioridade (score)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pb-1.5">
            <input
              type="checkbox"
              id="priority"
              name="priority"
              value="1"
              defaultChecked={priorityOnly}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
            />
            <label htmlFor="priority" className="text-sm text-zinc-700 dark:text-zinc-300">
              só prioritários
            </label>
          </div>

          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            Filtrar
          </button>
          {(category || status !== "all" || search || priorityOnly || siteFilter) && (
            <a
              href="/"
              className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
            >
              limpar filtros
            </a>
          )}
        </form>

        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          {filtered.length} resultado(s) — página {currentPage} de {totalPages}
        </p>

        <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">WordPress</th>
                <th className="px-4 py-3">Performance</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status envio</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((lead) => (
                <tr
                  key={lead.id}
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${
                    isPriorityProspect(lead)
                      ? "bg-amber-50 dark:bg-amber-950/20"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {computeLeadScore(lead)}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {lead.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {lead.category}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span>{lead.phone ?? "-"}</span>
                      {!lead.website && whatsappLink(lead.phone) && (
                        <a
                          href={whatsappLink(lead.phone)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {lead.website ? (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        site
                      </a>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">sem site</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {lead.is_wordpress === null ? "-" : lead.is_wordpress ? "sim" : "não"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {lead.performance_score ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {lead.email ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {lead.outreach_status && STATUS_BADGES[lead.outreach_status] ? (
                        <span
                          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[lead.outreach_status].className}`}
                        >
                          {STATUS_BADGES[lead.outreach_status].label}
                          {lead.outreach_status === "contacted" &&
                            ` ${formatDate(lead.contacted_at)}`}
                        </span>
                      ) : lead.email ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          Pendente
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">-</span>
                      )}
                      {lead.follow_up_sent_at && (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                          ↻ Follow-up {formatDate(lead.follow_up_sent_at)}
                        </span>
                      )}
                      {lead.opened_at && (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                          👀 Abriu {formatDate(lead.opened_at)}
                        </span>
                      )}
                      {lead.clicked_at && (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-950 dark:text-pink-400">
                          🔗 Clicou {formatDate(lead.clicked_at)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {lead.outreach_status &&
                        PIPELINE_STATUSES.includes(lead.outreach_status) && (
                          <PipelineStageSelect
                            leadId={lead.id}
                            currentStatus={lead.outreach_status}
                          />
                        )}
                      {lead.outreach_status !== "ignored" && (
                        <IgnoreButton leadId={lead.id} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            <a
              href={
                currentPage > 1
                  ? buildQuery({ ...baseParams, page: String(currentPage - 1) })
                  : "#"
              }
              className={`rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 ${
                currentPage <= 1
                  ? "pointer-events-none opacity-40"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              ← Anterior
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
              className={`rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 ${
                currentPage >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              Próxima →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
