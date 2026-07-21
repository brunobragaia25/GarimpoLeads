// Deteccao simples (sem custo de IA) de mensagem automatica vinda do outro
// lado (autoresponder, assistente virtual do proprio lead, "fora do
// horario", etc.) - sem isso, duas IAs podem entrar num loop respondendo
// uma a outra indefinidamente, cada troca gastando tokens de verdade.
// Propositalmente conservador: so casa frases que uma pessoa real
// dificilmente escreveria sozinha numa conversa comum de WhatsApp.
const BOT_REPLY_PATTERNS = [
  "mensagem automatica",
  "resposta automatica",
  "esta e uma resposta automatica",
  "essa e uma mensagem automatica",
  "atendimento automatico",
  "assistente virtual",
  "sou um assistente virtual",
  "chatbot",
  "sou um bot",
  "sou uma ia",
  "sou uma inteligencia artificial",
  "no momento estou ausente",
  "estou ausente no momento",
  "fora do horario de atendimento",
  "fora do horario de funcionamento",
  "retornaremos em breve",
  "retornarei em breve",
  "em breve retornaremos",
  "nao verifico esse numero",
  "nao monitoro esse numero",
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .trim();
}

export function detectBotReply(text: string): boolean {
  const normalized = normalize(text);
  return BOT_REPLY_PATTERNS.some((p) => normalized.includes(p));
}
