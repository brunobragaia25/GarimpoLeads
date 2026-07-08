import { getLeadsWithDetails, isPriorityProspect } from "@/lib/leads";

export const dynamic = "force-dynamic";

export default async function Home() {
  const leads = await getLeadsWithDetails();
  const prospects = leads.filter(isPriorityProspect).length;
  const withEmail = leads.filter((l) => l.email).length;

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          GarimpoLeads
        </h1>
        <div className="mt-2 flex gap-6 text-sm text-zinc-600 dark:text-zinc-400">
          <span>{leads.length} leads no total</span>
          <span>{prospects} prospects prioritários</span>
          <span>{withEmail} com email encontrado</span>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
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
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
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
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {lead.outreach_status ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
