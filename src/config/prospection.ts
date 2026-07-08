export const CATEGORIES = [
  "advogados",
  "dentistas",
  "arquitetos",
  "clínicas veterinárias",
  "clínicas de estética",
  "escritórios de contabilidade",
  "imobiliárias",
];

// Cobre as 5 regiões do Brasil; a rotação diária percorre esse conjunto
// junto com CATEGORIES ao longo de várias semanas.
export const CITIES = [
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

const ALL_PAIRS: CategoryCityPair[] = CATEGORIES.flatMap((category) =>
  CITIES.map((location) => ({ category, location }))
);

/**
 * Escolhe determinística e ciclicamente `count` pares categoria+cidade
 * pro dia informado, avançando o "cursor" a cada chamada de dia diferente.
 * Sem estado em banco: baseado só no dia do ano, então é idempotente por dia.
 */
export function getPairsForDay(date: Date, count: number): CategoryCityPair[] {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
  );

  const startIndex = (dayOfYear * count) % ALL_PAIRS.length;

  const pairs: CategoryCityPair[] = [];
  for (let i = 0; i < count; i++) {
    pairs.push(ALL_PAIRS[(startIndex + i) % ALL_PAIRS.length]);
  }
  return pairs;
}
