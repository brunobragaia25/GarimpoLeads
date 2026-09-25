import { describe, expect, it } from "vitest";
import { classifyInbound, extractReplyText, matchReplies, type InboundMessage } from "../reply-matching";

const sentAt = new Date("2026-09-10T12:00:00Z");
const after = new Date("2026-09-11T09:00:00Z");
const cand = (email: string, id = "o1") => ({ id, leadId: "l-" + id, email, contactedAt: sentAt });
const msg = (over: Partial<InboundMessage>): InboundMessage => ({
  from: "dono@clinica.com", subject: "Re: A new version of your website", date: after, text: "Sim, tenho interesse, pode me mostrar?", ...over,
});

describe("classifyInbound", () => {
  it("resposta de pessoa", () => expect(classifyInbound(msg({}))).toBe("human"));
  it("bounce", () => {
    expect(classifyInbound(msg({ from: "mailer-daemon@googlemail.com" }))).toBe("bounce");
    expect(classifyInbound(msg({ subject: "Undeliverable: A new version" }))).toBe("bounce");
  });
  it("resposta automatica", () => {
    expect(classifyInbound(msg({ subject: "Automatic reply: A new version" }))).toBe("auto");
    expect(classifyInbound(msg({ subject: "Resposta automática: site" }))).toBe("auto");
    expect(classifyInbound(msg({ autoSubmitted: "auto-replied" }))).toBe("auto");
    expect(classifyInbound(msg({ precedence: "bulk" }))).toBe("auto");
    expect(classifyInbound(msg({ autoSubmitted: "no" }))).toBe("human");
  });
  it("pedido de descadastro", () => {
    expect(classifyInbound(msg({ text: "Please unsubscribe me from this list" }))).toBe("unsubscribe");
    expect(classifyInbound(msg({ text: "Não quero receber mais esses e-mails" }))).toBe("unsubscribe");
    expect(classifyInbound(msg({ text: "Por favor, deixe de receber" }))).toBe("unsubscribe");
  });
});

describe("extractReplyText", () => {
  it("tira texto citado e corta no 'wrote:'", () => {
    const raw = "Tenho interesse!\nPode ligar amanhã?\n\nOn Thu, Sep 10, 2026 at 12:00 PM Bruno <bruno@devzdesign.com.br> wrote:\n> Hi! My name is Bruno\n> We build websites";
    expect(extractReplyText(raw)).toBe("Tenho interesse! Pode ligar amanhã?");
  });
  it("limita o tamanho", () => expect(extractReplyText("a".repeat(500)).length).toBe(300));
});

describe("matchReplies", () => {
  it("casa pelo mesmo endereco", () => {
    const [m] = matchReplies([msg({ from: "dono@clinica.com" })], [cand("dono@clinica.com")]);
    expect(m).toMatchObject({ outreachId: "o1", kind: "reply", via: "email" });
  });

  it("casa por dominio de empresa (respondeu de outro endereco)", () => {
    const [m] = matchReplies([msg({ from: "joao@clinica.com" })], [cand("info@clinica.com")]);
    expect(m).toMatchObject({ outreachId: "o1", via: "domain" });
  });

  it("NAO casa por dominio de e-mail gratuito", () => {
    expect(matchReplies([msg({ from: "outra.pessoa@gmail.com" })], [cand("dono@gmail.com")])).toEqual([]);
  });

  it("ignora mensagem anterior ao envio, bounce e resposta automatica", () => {
    const c = [cand("dono@clinica.com")];
    expect(matchReplies([msg({ date: new Date("2026-09-09T00:00:00Z") })], c)).toEqual([]);
    expect(matchReplies([msg({ from: "mailer-daemon@clinica.com" })], c)).toEqual([]);
    expect(matchReplies([msg({ subject: "Out of office" })], c)).toEqual([]);
  });

  it("pedido de descadastro vira 'unsubscribe' e nao e sobrescrito por resposta comum depois", () => {
    const messages = [
      msg({ text: "Please remove me from your list", date: new Date("2026-09-11T09:00:00Z") }),
      msg({ text: "Ok, thanks", date: new Date("2026-09-12T09:00:00Z") }),
    ];
    const [m] = matchReplies(messages, [cand("dono@clinica.com")]);
    expect(m.kind).toBe("unsubscribe");
  });

  it("uma mensagem por lead, com o snippet limpo", () => {
    const res = matchReplies([msg({ text: "Quero ver!\n> texto citado" })], [cand("dono@clinica.com"), cand("outro@empresa.com", "o2")]);
    expect(res).toHaveLength(1);
    expect(res[0].snippet).toBe("Quero ver!");
  });
});
