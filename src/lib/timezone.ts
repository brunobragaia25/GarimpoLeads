// Brasil aboliu o horário de verão em 2019: o offset de Brasília é sempre
// fixo em UTC-3, então não precisa de lógica de DST aqui.
const BRASILIA_OFFSET = "-03:00";

export function startOfTodayBrasiliaISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return new Date(`${parts}T00:00:00${BRASILIA_OFFSET}`).toISOString();
}
