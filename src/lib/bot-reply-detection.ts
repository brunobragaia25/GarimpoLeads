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
  // Menu automatico de atendimento (IVR por texto) - muito comum em
  // WhatsApp Business de empresas maiores, geralmente vem com uma
  // saudacao + lista numerada de opcoes + numero de protocolo.
  "protocolo de atendimento",
  "digite o numero",
  "digite somente o numero",
  "digite a opcao",
  "escolha uma das opcoes",
  "selecione uma das opcoes",
  "para ser redirecionado",
  "departamento desejado",
  // Saudacao automatica de boas-vindas (muito comum em bot de atendimento
  // corporativo - vem antes ou junto do menu numerado, as vezes sozinha).
  "bem-vindo",
  "bem vindo",
  "seja bem-vindo",
  "seja bem vindo",
  // Frases genericas de "recebemos sua mensagem" / "aguarde" tipicas de
  // autoresponder corporativo, sem citar explicitamente que e automatico.
  "obrigado por entrar em contato",
  "obrigada por entrar em contato",
  "agradecemos o contato",
  "recebemos sua mensagem",
  "em breve um de nossos atendentes",
  "em breve um atendente",
  "em breve iremos retornar",
  "iremos retornar em breve",
  "sua mensagem e muito importante",
  "sua mensagem é muito importante",
  "aguarde que iremos",
  "por favor aguarde",
  "nosso horario de atendimento e",
  "nosso horario de funcionamento e",
  "este numero nao recebe",
  "este numero e apenas para envio",
  "canal automatico",
  "central de atendimento",
  // Saudacao automatica tipo clinica/consultorio: "[Nome] agradece seu
  // contato... poderia nos informar seu nome... ja conhece nossa pagina
  // do instagram" - fluxo de intake classico de bot, sem se identificar
  // como automatico em nenhum momento.
  "agradece seu contato",
  "agradece o seu contato",
  "agradece pelo contato",
  "estamos felizes em te atender",
  "ficamos felizes em atender",
  "feliz em te atender",
  "poderia nos informar seu nome",
  "poderia informar seu nome",
  "para iniciarmos o seu atendimento",
  "para iniciarmos seu atendimento",
  "ja iremos te responder",
  "ja iremos responder",
  "ja conhece nossa pagina",
  "conheca nossa pagina do instagram",
];

// Heuristica estrutural complementar: menu de atendimento automatico quase
// sempre lista varias opcoes numeradas (ex: "1 - Atendimento", "2 -
// Contabil"), formato que uma pessoa real escrevendo no chat nao usa.
// 3+ linhas nesse formato e sinal forte o suficiente sozinho, mesmo sem
// nenhuma das frases acima.
const NUMBERED_MENU_LINE = /^\s*\d+\s*[-.)]\s*\S/gm;
const MIN_NUMBERED_MENU_LINES = 3;

function hasNumberedMenu(text: string): boolean {
  const matches = text.match(NUMBERED_MENU_LINE);
  return (matches?.length ?? 0) >= MIN_NUMBERED_MENU_LINES;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .trim();
}

export function detectBotReply(text: string): boolean {
  if (hasNumberedMenu(text)) return true;
  const normalized = normalize(text);
  return BOT_REPLY_PATTERNS.some((p) => normalized.includes(p));
}
