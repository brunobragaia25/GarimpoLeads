import {
  getLeadsWithDetails,
  isPriorityProspect,
  matchesEmailFilter,
  type EmailFilter,
} from "@/lib/leads";
import { SendOutreachButton } from "./SendOutreachButton";

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
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const allLeads = await getLeadsWithDetails();

  const categories = [...new Set(allLeads.map((l) => l.category))].sort();

  const filtered = allLeads.filter((lead) => {
    if (category && lead.category !== category) return false;
    if (!matchesEmailFilter(lead, status)) return false;
    if (search && !lead.name.toLowerCase().includes(search)) return false;
    return true;
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

  const baseParams = { category, status, search };

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            GarimpoLeads
          </h1>
          <a
            href="/template"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            editar template de mensagem
          </a>
        </div>
        <div className="mt-2 flex flex-wrap gap-6 text-sm text-zinc-600 dark:text-zinc-400">
          <span>{allLeads.length} leads no total</span>
          <span>{prospects} prospects prioritários</span>
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

          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            Filtrar
          </button>
          {(category || status !== "all" || search) && (
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
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">WordPress</th>
                <th className="px-4 py-3">Performance</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status envio</th>
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
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {lead.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {lead.category}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {lead.phone ?? "-"}
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
                    {lead.outreach_status === "contacted" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        ✓ Enviado {formatDate(lead.contacted_at)}
                      </span>
                    ) : lead.email ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Pendente
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">-</span>
                    )}
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
