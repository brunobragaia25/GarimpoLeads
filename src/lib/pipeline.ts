import { supabase } from "./supabase";
import { searchLeads } from "./google-maps";
import { deduplicateLeads, normalizePhone } from "./deduplication";
import { analyzeSite } from "./site-analysis";
import { findEmailForWebsite } from "./hunter";
import { scrapeEmailFromWebsite } from "./email-scraper";

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

  const { data: existing } = await supabase
    .from("leads")
    .select("name, address")
    .eq("category", category);

  const existingKeys = new Set(
    (existing ?? []).map(
      (l) => `${l.name.trim().toLowerCase()}|${(l.address ?? "").trim().toLowerCase()}`
    )
  );

  // Telefone é checado contra TODAS as categorias (não só a atual), pra
  // evitar contatar o mesmo negócio duas vezes se ele aparecer em buscas
  // de nichos diferentes (ex: escritório que é ao mesmo tempo "advogados"
  // e "escritórios de contabilidade").
  const { data: existingPhones } = await supabase.from("leads").select("phone");
  const existingPhoneSet = new Set(
    (existingPhones ?? [])
      .map((l) => normalizePhone(l.phone))
      .filter((p): p is string => p !== null)
  );

  const newLeads = deduped.filter((l) => {
    const key = `${l.name.trim().toLowerCase()}|${(l.address ?? "").trim().toLowerCase()}`;
    if (existingKeys.has(key)) return false;

    const phone = normalizePhone(l.phone);
    if (phone && existingPhoneSet.has(phone)) return false;

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
  const { data: analyzed } = await supabase.from("site_analysis").select("lead_id");
  const analyzedIds = new Set((analyzed ?? []).map((a) => a.lead_id));

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
  const { data: noWebsiteLeads, error: noWebsiteError } = await supabase
    .from("leads")
    .select("id, website")
    .is("website", null)
    .order("created_at", { ascending: true })
    .limit(5000);

  if (noWebsiteError) throw new Error(noWebsiteError.message);

  const pendingNoWebsite = (noWebsiteLeads ?? [])
    .filter((l) => !analyzedIds.has(l.id))
    .slice(0, limit);
  const remainingSlots = limit - pendingNoWebsite.length;

  let pendingWithWebsite: { id: string; website: string | null }[] = [];
  if (remainingSlots > 0) {
    const { data: withWebsiteLeads, error: withWebsiteError } = await supabase
      .from("leads")
      .select("id, website")
      .not("website", "is", null)
      .order("created_at", { ascending: true })
      .limit(5000);

    if (withWebsiteError) throw new Error(withWebsiteError.message);

    pendingWithWebsite = (withWebsiteLeads ?? [])
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
// raspagem nao acha nada. Leads que falham nos dois metodos ficam sem
// registro em `outreach`, entao sao retentados automaticamente no proximo dia.
export async function findPendingEmails(hunterLimit = 2, scrapeLimit = 100) {
  const { data: existing } = await supabase.from("outreach").select("lead_id");
  const processedIds = new Set((existing ?? []).map((o) => o.lead_id));

  // Ordenado do mais antigo pro mais novo, e limite bem acima do total de
  // leads-com-site esperado, senao um teto baixo faz o mesmo lote antigo
  // ser reconsiderado pra sempre enquanto leads novos nunca sao alcancados.
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, website")
    .not("website", "is", null)
    .order("created_at", { ascending: true })
    .limit(5000);

  if (error) throw new Error(error.message);

  const pending = (leads ?? [])
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
      rows.push({
        lead_id: lead.id,
        email: hunterResult.email,
        email_confidence: hunterResult.confidence,
        status: "pending",
        notes: "Fonte: hunter_domain_search",
      });
    }
    // Se a raspagem falhou e a cota do Hunter acabou, não grava nada:
    // o lead continua pendente e será retentado no próximo dia.
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
