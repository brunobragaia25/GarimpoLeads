import { supabase } from "./supabase";
import { searchLeads } from "./google-maps";
import { deduplicateLeads, normalizePhone } from "./deduplication";
import { analyzeSite } from "./site-analysis";
import { findEmailForWebsite } from "./hunter";
import { scrapeEmailFromWebsite } from "./email-scraper";
import { fetchBlockedPhones } from "./blocklist";

// O PostgREST do Supabase trunca qualquer resposta em 1000 linhas (config
// "Max Rows" do projeto) mesmo com `.limit()` maior no client - sem paginar
// com `.range()`, as checagens de duplicidade abaixo passavam a ignorar
// todo lead além da linha 1000 assim que a tabela cresceu, permitindo
// duplicata silenciosa uma vez que o total passou de 1000 leads.
const POSTGREST_PAGE_SIZE = 1000;

async function fetchAllLeadNamesAndAddresses(category: string): Promise<{ name: string; address: string | null }[]> {
  const rows: { name: string; address: string | null }[] = [];

  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("leads")
      .select("name, address")
      .eq("category", category)
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < POSTGREST_PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllLeadPhones(): Promise<{ phone: string | null }[]> {
  const rows: { phone: string | null }[] = [];

  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("leads")
      .select("phone")
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < POSTGREST_PAGE_SIZE) break;
  }

  return rows;
}

// Usado tanto pra achar leads sem site (classificação instantânea) quanto
// leads com site (precisa analisar de verdade) - mesma paginação nos dois
// casos, só muda o filtro de presença de website.
async function fetchAllLeadsByWebsitePresence(
  hasWebsite: boolean
): Promise<{ id: string; website: string | null }[]> {
  const rows: { id: string; website: string | null }[] = [];

  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    let query = supabase
      .from("leads")
      .select("id, website")
      .order("created_at", { ascending: true })
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1);

    query = hasWebsite ? query.not("website", "is", null) : query.is("website", null);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < POSTGREST_PAGE_SIZE) break;
  }

  return rows;
}

// Coluna única (ex: "lead_id") de outra tabela, paginada - usado pra montar
// os conjuntos "já processado" (site_analysis, outreach, whatsapp_conversations).
async function fetchAllColumn(table: string, column: string): Promise<string[]> {
  const rows: string[] = [];

  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows.push(...(data as any[]).map((r) => r[column]));
    if (data.length < POSTGREST_PAGE_SIZE) break;
  }

  return rows;
}

// Roda ate `concurrency` chamadas de `fn` em paralelo em vez de uma por
// vez, pra aproveitar melhor o orcamento de tempo do cron diario (a
// maior parte do tempo de analise/busca de email e so esperando resposta
// HTTP de sites de terceiros, entao paralelizar multiplica o throughput).
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return results;
}

export async function scrapeLeadsForQuery(category: string, location: string) {
  const found = await searchLeads(category, location);
  const deduped = deduplicateLeads(found);

  const existing = await fetchAllLeadNamesAndAddresses(category);

  const existingKeys = new Set(
    existing.map(
      (l) => `${l.name.trim().toLowerCase()}|${(l.address ?? "").trim().toLowerCase()}`
    )
  );

  // Telefone é checado contra TODAS as categorias (não só a atual), pra
  // evitar contatar o mesmo negócio duas vezes se ele aparecer em buscas
  // de nichos diferentes (ex: escritório que é ao mesmo tempo "advogados"
  // e "escritórios de contabilidade").
  const existingPhones = await fetchAllLeadPhones();
  const existingPhoneSet = new Set(
    existingPhones
      .map((l) => normalizePhone(l.phone))
      .filter((p): p is string => p !== null)
  );

  // Telefones bloqueados (lead excluido antes) tambem contam como
  // duplicata - sem isso, o mesmo negocio reaparece "novo" num scraping
  // futuro e volta pra fila de contato.
  const blockedPhones = await fetchBlockedPhones();

  const newLeads = deduped.filter((l) => {
    const key = `${l.name.trim().toLowerCase()}|${(l.address ?? "").trim().toLowerCase()}`;
    if (existingKeys.has(key)) return false;

    const phone = normalizePhone(l.phone);
    if (phone && (existingPhoneSet.has(phone) || blockedPhones.has(phone))) return false;

    return true;
  });

  if (newLeads.length > 0) {
    const { error } = await supabase.from("leads").insert(newLeads);
    if (error) throw new Error(error.message);
  }

  return {
    found: found.length,
    new_leads: newLeads.length,
    skipped_duplicates: deduped.length - newLeads.length,
  };
}

export async function analyzePendingSites(limit = 50) {
  const analyzedIds = new Set(await fetchAllColumn("site_analysis", "lead_id"));

  // Janela bem maior que o total esperado de leads, com o filtro de "ja
  // analisado" aplicado DEPOIS da busca: se o limite da query fosse
  // pequeno, os leads mais antigos (todos ja analisados) ocupariam a
  // janela inteira pra sempre e os novos nunca seriam alcancados - mesma
  // starvation ja corrigida em findPendingEmails.
  //
  // Leads sem site sao classificados na hora, sem nenhuma chamada de rede
  // (analyzeSite retorna instantaneo quando `website` e null) - por isso
  // vao primeiro: sao o foco do negocio (prospect direto pra vender site)
  // e nao custam nada do orcamento de tempo.
  const noWebsiteLeads = await fetchAllLeadsByWebsitePresence(false);

  const pendingNoWebsite = noWebsiteLeads
    .filter((l) => !analyzedIds.has(l.id))
    .slice(0, limit);
  const remainingSlots = limit - pendingNoWebsite.length;

  let pendingWithWebsite: { id: string; website: string | null }[] = [];
  if (remainingSlots > 0) {
    const withWebsiteLeads = await fetchAllLeadsByWebsitePresence(true);

    pendingWithWebsite = withWebsiteLeads
      .filter((l) => !analyzedIds.has(l.id))
      .slice(0, remainingSlots);
  }

  const pending = [...pendingNoWebsite, ...pendingWithWebsite];

  const rows = await mapWithConcurrency(pending, 8, async (lead) => {
    const result = await analyzeSite(lead.website ?? undefined);
    return { lead_id: lead.id, ...result };
  });

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("site_analysis").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  return { analyzed: rows.length };
}

// Estrategia: tenta raspar o email direto do site primeiro (gratis, sem
// limite de cota). So recorre ao Hunter.io (cota mensal escassa) quando a
// raspagem nao acha nada. Leads em que a raspagem falhou e a cota do Hunter
// ja tinha acabado ficam sem registro em `outreach` e sao retentados no
// proximo dia; leads em que o Hunter foi consultado e nao achou nada ganham
// registro com email null, pra nao queimar a cota de novo no mesmo lead.
export async function findPendingEmails(hunterLimit = 2, scrapeLimit = 100) {
  const processedIds = new Set(await fetchAllColumn("outreach", "lead_id"));

  // Ordenado do mais antigo pro mais novo, e limite bem acima do total de
  // leads-com-site esperado, senao um teto baixo faz o mesmo lote antigo
  // ser reconsiderado pra sempre enquanto leads novos nunca sao alcancados.
  const leads = await fetchAllLeadsByWebsitePresence(true);

  const pending = leads
    .filter((l) => !processedIds.has(l.id))
    .slice(0, scrapeLimit);

  // Raspagem direta em paralelo (gratis, sem cota) - o fallback do Hunter
  // continua sequencial pois a cota diaria e pequena e precisa contar
  // certinho quantas chamadas ja foram usadas.
  const scrapeResults = await mapWithConcurrency(pending, 8, async (lead) => ({
    lead,
    scraped: await scrapeEmailFromWebsite(lead.website!),
  }));

  const rows = [];
  let hunterUsed = 0;

  for (const { lead, scraped } of scrapeResults) {
    if (scraped.email) {
      rows.push({
        lead_id: lead.id,
        email: scraped.email,
        email_confidence: scraped.confidence,
        status: "pending",
        notes: `Fonte: ${scraped.source}`,
      });
      continue;
    }

    if (hunterUsed < hunterLimit) {
      hunterUsed++;
      const hunterResult = await findEmailForWebsite(lead.website!);
      // Grava a linha MESMO se o Hunter não achou nada (email null): o
      // lead fica marcado como processado de vez, senão a cota escassa do
      // Hunter seria queimada de novo no mesmo lead todo dia. Linhas com
      // email null nunca entram no envio (sendPendingOutreach filtra).
      rows.push({
        lead_id: lead.id,
        email: hunterResult.email,
        email_confidence: hunterResult.confidence,
        status: "pending",
        notes: hunterResult.email
          ? "Fonte: hunter_domain_search"
          : "Fonte: hunter_domain_search (sem resultado)",
      });
    }
    // Se a raspagem falhou e a cota do Hunter acabou, não grava nada:
    // o lead continua sem registro e será retentado no próximo dia.
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("outreach").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  return {
    processed: rows.length,
    emails_found: rows.filter((r) => r.email).length,
    hunter_calls_used: hunterUsed,
  };
}
