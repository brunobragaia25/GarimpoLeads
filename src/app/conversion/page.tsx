import { supabase } from "@/lib/supabase";
import { COUNTRIES, COUNTRY_CODES, type Country } from "@/lib/countries";
import { PageHeader } from "../PageHeader";
import { TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

interface Row {
  country: Country;
  category: string;
  outreach_status: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  contacted_date: string;
}

// Quem passou de "respondeu" no funil conta como resposta tambem.
const REPLIED = new Set(["responded", "meeting_scheduled", "proposal_sent", "closed_won", "closed_lost"]);
const MEETING = new Set(["meeting_scheduled", "proposal_sent", "closed_won", "closed_lost"]);

async function fetchContacted(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("lead_overview")
      .select("country, category, outreach_status, opened_at, clicked_at, replied_at, contacted_date")
      .not("contacted_at", "is", null)
      .not("email", "is", null)
      .range(from, from + 999);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

interface Stats {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  meetings: number;
  won: number;
  bounced: number;
  unsubscribed: number;
}

const empty = (): Stats => ({ sent: 0, opened: 0, clicked: 0, replied: 0, meetings: 0, won: 0, bounced: 0, unsubscribed: 0 });

function add(s: Stats, r: Row) {
  s.sent++;
  if (r.opened_at) s.opened++;
  if (r.clicked_at) s.clicked++;
  const st = r.outreach_status ?? "";
  if (REPLIED.has(st) || (r.replied_at && st !== "unsubscribed")) s.replied++;
  if (MEETING.has(st)) s.meetings++;
  if (st === "closed_won") s.won++;
  if (st === "bounced") s.bounced++;
  if (st === "unsubscribed") s.unsubscribed++;
}

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(n / d < 0.1 ? 1 : 0)}%` : "—");

function StatsTable({ title, rows }: { title: string; rows: { label: string; s: Stats }[] }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-2 font-medium">{title.split(" ").pop()}</th>
              <th className="px-3 py-2 text-right font-medium">Enviados</th>
              <th className="px-3 py-2 text-right font-medium">Abertos</th>
              <th className="px-3 py-2 text-right font-medium">Cliques</th>
              <th className="px-3 py-2 text-right font-medium">Respostas</th>
              <th className="px-3 py-2 text-right font-medium">Reuniões</th>
              <th className="px-3 py-2 text-right font-medium">Fechados</th>
              <th className="px-3 py-2 text-right font-medium">Bounce</th>
              <th className="px-3 py-2 text-right font-medium">Descad.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, s }) => (
              <tr key={label} className="border-b border-zinc-50 last:border-0 dark:border-zinc-900">
                <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">{label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.sent}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.opened} <span className="text-zinc-400">({pct(s.opened, s.sent)})</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{s.clicked} <span className="text-zinc-400">({pct(s.clicked, s.sent)})</span></td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{s.replied} <span className="font-normal text-zinc-400">({pct(s.replied, s.sent)})</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{s.meetings}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.won}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.bounced} <span className="text-zinc-400">({pct(s.bounced, s.sent)})</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{s.unsubscribed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function ConversionPage() {
  const rows = await fetchContacted();

  const total = empty();
  const byCountry = new Map<Country, Stats>();
  const byCategory = new Map<string, Stats>();
  for (const r of rows) {
    add(total, r);
    add(byCountry.get(r.country) ?? byCountry.set(r.country, empty()).get(r.country)!, r);
    add(byCategory.get(r.category) ?? byCategory.set(r.category, empty()).get(r.category)!, r);
  }

  const countryRows = COUNTRY_CODES.filter((c) => byCountry.has(c)).map((c) => ({
    label: `${COUNTRIES[c].flag} ${COUNTRIES[c].name}`,
    s: byCountry.get(c)!,
  }));
  // Categorias com poucos envios distorcem a taxa, entao ficam no fim.
  const categoryRows = [...byCategory.entries()]
    .map(([label, s]) => ({ label, s }))
    .sort((a, b) => b.s.replied - a.s.replied || b.s.sent - a.s.sent);

  const cards = [
    { label: "E-mails enviados", value: total.sent, note: "" },
    { label: "Respostas", value: total.replied, note: pct(total.replied, total.sent) },
    { label: "Reuniões", value: total.meetings, note: pct(total.meetings, total.sent) },
    { label: "Fechados (ganho)", value: total.won, note: pct(total.won, total.sent) },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/conversion" />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Conversão</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Do envio ao fechamento, por país e categoria (só e-mail)</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{c.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {c.value} {c.note && <span className="text-sm font-normal text-zinc-400">{c.note}</span>}
              </div>
            </div>
          ))}
        </div>

        <StatsTable title="Por país" rows={countryRows} />
        <StatsTable title="Por categoria" rows={categoryRows} />

        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
          Aberturas e cliques inflam: muitos servidores e robôs abrem o e-mail sozinhos. A métrica que vale é a de respostas.
        </p>
      </main>
    </div>
  );
}
