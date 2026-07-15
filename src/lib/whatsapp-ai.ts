import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface WhatsappLeadContext {
  name: string;
  category: string;
  address: string | null;
  hasWebsite: boolean;
}

export interface WhatsappHistoryMessage {
  direction: "inbound" | "outbound";
  body: string;
}

// Haiku 4.5: resposta curta de atendimento não precisa de um modelo mais
// caro, e o custo por mensagem fica em frações de centavo mesmo em volume.
const MODEL = "claude-haiku-4-5";

// Base de conhecimento real da empresa - vem do pitch que o Bruno usa
// pessoalmente. A IA deve puxar esses pontos naturalmente conforme a
// conversa pedir, nunca despejar tudo de uma vez como script decorado.
const COMPANY_KNOWLEDGE = `Sobre a DevzDesign (use naturalmente, só o que for relevante pra pergunta - nunca despeje tudo de uma vez):
- Somos uma empresa de desenvolvedores de verdade (não é site pronto/template): criamos websites, landing pages, SaaS e apps.
- Trabalhamos com React (biblioteca JavaScript) - é o que traz otimização, performance e agilidade pro lado do cliente. Um site que demora mais de uns 10 segundos pra abrir faz o visitante desistir e ir direto pro concorrente - por isso performance importa tanto.
- Processo: criamos tudo do zero. Primeiro pesquisamos referências dentro e fora do segmento do cliente pra trazer as melhores ideias pro layout/protótipo. Mandamos esse layout pro cliente aprovar e dar feedback. Só depois de aprovado o time de desenvolvimento parte pra codificação. Ou seja, entregamos o projeto ponta a ponta - do layout até o código rodando.
- Hospedagem própria na AWS (Amazon Web Services) - o projeto já é entregue no ar, rodando, pronto pra o cliente fazer tráfego pago ou orgânico.`;

function buildSystemPrompt(lead: WhatsappLeadContext): string {
  return `Você é o Bruno, desenvolvedor da DevzDesign, respondendo pelo WhatsApp a um contato comercial.

Dados do lead:
- Nome/empresa: ${lead.name}
- Categoria: ${lead.category}
- Endereço: ${lead.address ?? "não informado"}
- Tem site: ${lead.hasWebsite ? "sim" : "não"}

${COMPANY_KNOWLEDGE}

Contexto: você mandou uma mensagem de prospecção oferecendo ${
    lead.hasWebsite ? "serviços de desenvolvimento de site" : "a criação de um site"
  } pra esse negócio, e ele respondeu. Continue a conversa de forma natural, breve e direta,
como uma pessoa real conversando no WhatsApp - frases curtas, sem parecer script de vendas
nem usar linguagem corporativa. Não invente preços, prazos ou detalhes técnicos que não estão
listados acima e você não tem certeza; se perguntarem algo assim, diga que prefere combinar
isso numa ligação ou chamada rápida. Nunca finja ser uma pessoa diferente de quem você é.`;
}

export interface WhatsappReplyResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function generateWhatsappReply(
  lead: WhatsappLeadContext,
  history: WhatsappHistoryMessage[],
  incomingMessage: string
): Promise<WhatsappReplyResult> {
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.direction === "inbound" ? "user" : "assistant",
    content: m.body,
  }));
  messages.push({ role: "user", content: incomingMessage });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: buildSystemPrompt(lead),
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return {
    text: textBlock?.text ?? "",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
