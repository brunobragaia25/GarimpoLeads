// Deteccao simples (sem custo de IA) de recusa clara do lead, pra nao gastar
// tokens gerando uma resposta com Claude quando a conversa ja acabou. So
// casa frases inequivocas de "nao quero" - propositalmente conservador pra
// nao fechar uma conversa que ainda podia ser salva (ex: "nao sei" ou "nao
// entendi" nao devem disparar isso).
const NEGATIVE_PATTERNS = [
  "nao tenho interesse",
  "sem interesse",
  "nao e do meu interesse",
  "nao quero",
  "nao preciso",
  "pare de mandar",
  "para de mandar",
  "nao manda mais",
  "nao mande mais",
  "me remove",
  "me tira da lista",
  "sai da lista",
  "descadastr",
  "nao, obrigado",
  "nao obrigado",
  "obrigado mas nao",
  "obrigada mas nao",
  "ja resolvido",
  "ja resolvi",
  "nao me contate",
  "nao entre em contato",
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .trim();
}

export function detectNegativeIntent(text: string): boolean {
  const normalized = normalize(text);
  if (normalized === "pare" || normalized === "para" || normalized === "stop") return true;
  return NEGATIVE_PATTERNS.some((p) => normalized.includes(p));
}
