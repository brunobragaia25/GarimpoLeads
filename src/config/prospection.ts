import { supabase } from "@/lib/supabase";

// Usados como fallback se a tabela `prospection_config` estiver vazia, e
// como sugestão inicial na tela de configurações do dashboard.
export const DEFAULT_CATEGORIES = [
  "advogados",
  "dentistas",
  "arquitetos",
  "clínicas veterinárias",
  "clínicas de estética",
  "escritórios de contabilidade",
  "imobiliárias",
];

// Cobre as 5 regiões do Brasil; a rotação diária percorre esse conjunto
// junto com as categorias ao longo de várias semanas.
export const DEFAULT_CITIES = [
  "São Paulo, SP",
  "Rio de Janeiro, RJ",
  "Belo Horizonte, MG",
  "Curitiba, PR",
  "Porto Alegre, RS",
  "Salvador, BA",
  "Brasília, DF",
  "Fortaleza, CE",
  "Recife, PE",
  "Manaus, AM",
  "Belém, PA",
  "Goiânia, GO",
  "Campinas, SP",
  "Florianópolis, SC",
  "Vitória, ES",
];

export interface CategoryCityPair {
  category: string;
  location: string;
}

export interface ProspectionConfig {
  categories: string[];
  cities: string[];
}

export async function getProspectionConfig(): Promise<ProspectionConfig> {
  const { data } = await supabase
    .from("prospection_config")
    .select("categories, cities")
    .limit(1)
    .maybeSingle();

  const categories =
    data?.categories && data.categories.length > 0 ? data.categories : DEFAULT_CATEGORIES;
  const cities = data?.cities && data.cities.length > 0 ? data.cities : DEFAULT_CITIES;

  return { categories, cities };
}

export async function saveProspectionConfig(
  categories: string[],
  cities: string[]
): Promise<void> {
  const { data: existing } = await supabase
    .from("prospection_config")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("prospection_config")
      .update({ categories, cities, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("prospection_config")
      .insert({ categories, cities });
    if (error) throw new Error(error.message);
  }
}

/**
 * Escolhe determinística e ciclicamente `count` pares categoria+cidade
 * pro dia informado, avançando o "cursor" a cada chamada de dia diferente.
 * Sem estado em banco pra rotação em si: baseado só no dia do ano, então é
 * idempotente por dia (a lista de categorias/cidades vem do banco).
 */
export async function getPairsForDay(
  date: Date,
  count: number
): Promise<CategoryCityPair[]> {
  const { categories, cities } = await getProspectionConfig();
  const allPairs: CategoryCityPair[] = categories.flatMap((category) =>
    cities.map((location) => ({ category, location }))
  );

  if (allPairs.length === 0) return [];

  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
  );

  const startIndex = (dayOfYear * count) % allPairs.length;

  const pairs: CategoryCityPair[] = [];
  for (let i = 0; i < count; i++) {
    pairs.push(allPairs[(startIndex + i) % allPairs.length]);
  }
  return pairs;
}
