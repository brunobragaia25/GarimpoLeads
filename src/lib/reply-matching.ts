import { detectBotReply } from "./bot-reply-detection";
import { detectNegativeIntent } from "./negative-intent";

// Decisao "essa mensagem da caixa de entrada e resposta de um lead?" -
// funcoes puras (sem rede), separadas da leitura do IMAP pra dar pra testar.

export interface InboundMessage {
  from: string; // endereco, minusculo
  subject: string;
  date: Date;
  text: string;
  autoSubmitted?: string;
  precedence?: string;
  xAutoreply?: boolean;
}

export interface OutreachCandidate {
  id: string;
  leadId: string;
  email: string;
  contactedAt: Date;
}

export type InboundKind = "bounce" | "auto" | "unsubscribe" | "human";

const BOUNCE_SENDER = /^(mailer-daemon|postmaster|mail-daemon)@/i;
const BOUNCE_SUBJECT = /undeliverable|delivery status|delivery failure|delivery has failed|returned mail|mail delivery failed|failure notice|não foi possível entregar|nao foi possivel entregar|falha na entrega|mensagem não entregue/i;
const AUTO_SUBJECT = /out of office|automatic reply|auto-?reply|autoreply|resposta autom[aá]tica|fora do escrit[oó]rio|ausente|vacation|férias|ferias/i;
const UNSUBSCRIBE_TEXT = /\b(unsubscribe|remove me|take me off|stop (emailing|sending|contacting)|do not (contact|email)|please stop)\b|n[aã]o quero|remov(a|am) (meu|o meu|nosso)|deix(ar|e|em) de (receber|enviar)|parar de (enviar|receber)|n[aã]o (me )?envie|retire (meu|o meu)/i;

export function classifyInbound(msg: InboundMessage): InboundKind {
  if (BOUNCE_SENDER.test(msg.from) || BOUNCE_SUBJECT.test(msg.subject)) return "bounce";

  const auto =
    (msg.autoSubmitted && msg.autoSubmitted.toLowerCase() !== "no") ||
    (msg.precedence && /bulk|auto_reply|junk|list/i.test(msg.precedence)) ||
    msg.xAutoreply ||
    AUTO_SUBJECT.test(msg.subject) ||
    detectBotReply(msg.text);
  if (auto) return "auto";

  if (UNSUBSCRIBE_TEXT.test(msg.text) || detectNegativeIntent(msg.text)) return "unsubscribe";
  return "human";
}

// Tira o texto citado da resposta ("> ..." e o "Em ... escreveu:") e limita
// o tamanho - so o que a pessoa realmente escreveu.
export function extractReplyText(raw: string, maxLength = 300): string {
  const lines: string[] = [];
  for (const line of raw.replace(/\r/g, "").split("\n")) {
    const trimmed = line.trim();
    if (/^(on .+wrote:|em .+escreveu:|de:|from:|-----original message-----|_{5,})/i.test(trimmed)) break;
    if (trimmed.startsWith(">")) continue;
    lines.push(trimmed);
  }
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

// Dominios de e-mail gratuito: mesmo dominio nao significa mesma empresa.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com", "msn.com", "yahoo.com", "yahoo.com.br",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "uol.com.br", "bol.com.br", "terra.com.br",
  "ig.com.br", "globo.com", "sapo.pt", "hotmail.co.uk", "yahoo.co.uk", "btinternet.com", "sky.com", "gmx.com",
]);

function domainOf(address: string): string {
  return address.split("@")[1]?.toLowerCase() ?? "";
}

export interface ReplyMatch {
  outreachId: string;
  leadId: string;
  kind: "reply" | "unsubscribe";
  from: string;
  snippet: string;
  date: Date;
  via: "email" | "domain";
}

// Casa mensagens recebidas com e-mails ja enviados. Mensagem so vale se for
// posterior ao envio. Mesmo endereco = certeza; mesmo dominio de empresa
// (nao gratuito) tambem casa, ja que a resposta costuma vir de outro
// endereco da mesma empresa (info@ -> dono@).
export function matchReplies(messages: InboundMessage[], candidates: OutreachCandidate[]): ReplyMatch[] {
  const byEmail = new Map<string, OutreachCandidate[]>();
  const byDomain = new Map<string, OutreachCandidate[]>();
  for (const c of candidates) {
    const email = c.email.toLowerCase();
    byEmail.set(email, [...(byEmail.get(email) ?? []), c]);
    const domain = domainOf(email);
    if (domain && !FREE_MAIL.has(domain)) byDomain.set(domain, [...(byDomain.get(domain) ?? []), c]);
  }

  const best = new Map<string, ReplyMatch>(); // por outreachId
  for (const msg of [...messages].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const kind = classifyInbound(msg);
    if (kind === "bounce" || kind === "auto") continue;

    let via: "email" | "domain" = "email";
    let pool = byEmail.get(msg.from.toLowerCase());
    if (!pool) {
      via = "domain";
      const domain = domainOf(msg.from);
      pool = domain && !FREE_MAIL.has(domain) ? byDomain.get(domain) : undefined;
    }
    for (const cand of pool ?? []) {
      if (msg.date.getTime() <= cand.contactedAt.getTime()) continue;
      const current = best.get(cand.id);
      // Pedido de descadastro tem prioridade sobre resposta comum.
      if (current?.kind === "unsubscribe" && kind !== "unsubscribe") continue;
      best.set(cand.id, {
        outreachId: cand.id,
        leadId: cand.leadId,
        kind: kind === "unsubscribe" ? "unsubscribe" : "reply",
        from: msg.from,
        snippet: extractReplyText(msg.text),
        date: msg.date,
        via,
      });
    }
  }
  return [...best.values()];
}
