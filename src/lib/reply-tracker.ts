import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { supabase } from "./supabase";
import { notifyTelegram } from "./telegram";
import { COUNTRIES, parseCountry } from "./countries";
import { matchReplies, type InboundMessage, type OutreachCandidate, type ReplyMatch } from "./reply-matching";

// Le a caixa de entrada (IMAP) e marca sozinho quem respondeu, em vez de
// depender de marcar a mao. Precisa de IMAP_USER e IMAP_PASSWORD (senha de
// app da caixa que recebe as respostas); IMAP_HOST/IMAP_PORT tem padrao do
// Titan. So le (readOnly) - nao move nem marca nada como lido.

export interface ReplyCheckResult {
  skipped?: string;
  scannedMessages?: number;
  candidates?: number;
  matches?: { outreachId: string; kind: string; from: string; via: string; snippet: string }[];
  applied?: number;
  error?: string;
}

async function loadCandidates(): Promise<OutreachCandidate[]> {
  // Enviados e ainda sem resposta detectada, dos ultimos 30 dias.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const rows: OutreachCandidate[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("outreach")
      .select("id, lead_id, email, contacted_at")
      .eq("status", "contacted")
      .not("email", "is", null)
      .is("replied_at", null)
      .gte("contacted_at", since)
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      rows.push({ id: r.id, leadId: r.lead_id, email: r.email, contactedAt: new Date(r.contacted_at) });
    }
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function readInbox(days: number, knownAddresses: Set<string>, knownDomains: Set<string>): Promise<InboundMessage[]> {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.titan.email",
    port: Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASSWORD! },
    logger: false,
  });
  const messages: InboundMessage[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const since = new Date(Date.now() - days * 86_400_000);
      const uids = (await client.search({ since }, { uid: true })) || [];
      if (uids.length === 0) return messages;

      // 1a passada (barata): so o remetente. Baixa o corpo apenas das que
      // vem de quem a gente contatou.
      const wanted: number[] = [];
      for await (const m of client.fetch(uids, { envelope: true, uid: true }, { uid: true })) {
        const from = m.envelope?.from?.[0]?.address?.toLowerCase();
        if (!from) continue;
        const domain = from.split("@")[1] ?? "";
        if (knownAddresses.has(from) || knownDomains.has(domain) || /^(mailer-daemon|postmaster)@/.test(from)) {
          wanted.push(m.uid);
        }
      }
      if (wanted.length === 0) return messages;

      for await (const m of client.fetch(wanted, { source: true, uid: true }, { uid: true })) {
        if (!m.source) continue;
        const parsed = await simpleParser(m.source);
        const from = parsed.from?.value?.[0]?.address?.toLowerCase();
        if (!from) continue;
        const header = (name: string) => {
          const v = parsed.headers.get(name);
          return typeof v === "string" ? v : undefined;
        };
        messages.push({
          from,
          subject: parsed.subject ?? "",
          date: parsed.date ?? new Date(),
          text: parsed.text ?? "",
          autoSubmitted: header("auto-submitted"),
          precedence: header("precedence"),
          xAutoreply: parsed.headers.has("x-autoreply") || parsed.headers.has("x-autorespond"),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return messages;
}

async function applyMatches(matches: ReplyMatch[]): Promise<number> {
  let applied = 0;
  for (const m of matches) {
    const update =
      m.kind === "unsubscribe"
        ? { status: "unsubscribed", replied_at: m.date.toISOString(), reply_snippet: m.snippet }
        : { status: "responded", replied_at: m.date.toISOString(), reply_snippet: m.snippet };
    // So muda quem ainda esta "contacted": nao desfaz um funil que voce ja
    // avancou na mao (reuniao marcada, proposta...).
    const { data, error } = await supabase
      .from("outreach")
      .update(update)
      .eq("id", m.outreachId)
      .eq("status", "contacted")
      .select("id, lead_id, email")
      .maybeSingle();
    if (error || !data) continue;
    applied++;

    const { data: lead } = await supabase.from("leads").select("name, country").eq("id", data.lead_id).maybeSingle();
    const country = COUNTRIES[parseCountry(lead?.country)];
    await notifyTelegram(
      m.kind === "unsubscribe"
        ? `🚫 ${country.flag} ${lead?.name ?? data.email} pediu para parar de receber e foi descadastrado.\n"${m.snippet}"`
        : `💬 ${country.flag} ${lead?.name ?? data.email} respondeu!\n"${m.snippet}"`
    );
  }
  return applied;
}

export async function checkReplies(options: { days?: number; dryRun?: boolean } = {}): Promise<ReplyCheckResult> {
  if (!process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
    return { skipped: "IMAP_USER / IMAP_PASSWORD nao configurados" };
  }
  try {
    const candidates = await loadCandidates();
    if (candidates.length === 0) return { scannedMessages: 0, candidates: 0, matches: [], applied: 0 };

    const addresses = new Set(candidates.map((c) => c.email.toLowerCase()));
    const domains = new Set([...addresses].map((a) => a.split("@")[1]).filter(Boolean));
    const messages = await readInbox(options.days ?? 10, addresses, domains);
    const matches = matchReplies(messages, candidates);
    const applied = options.dryRun ? 0 : await applyMatches(matches);
    return {
      scannedMessages: messages.length,
      candidates: candidates.length,
      matches: matches.map((m) => ({ outreachId: m.outreachId, kind: m.kind, from: m.from, via: m.via, snippet: m.snippet })),
      applied,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "erro desconhecido" };
  }
}
