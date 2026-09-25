import { beforeEach, describe, expect, it, vi } from "vitest";

// Banco e Resend simulados: roda o fluxo REAL de sendPendingOutreach sem
// enviar nada nem tocar no banco.
const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  updates: [] as { table: string; values: Record<string, unknown>; id?: unknown }[],
  sent: [] as { to: string; subject: string; body: string }[],
  countToday: 0,
}));

vi.mock("../supabase", () => {
  // Builder encadeavel e "await-avel", como o do supabase-js.
  function builder(table: string) {
    const ctx: { op: string; values?: Record<string, unknown>; count: boolean; id?: unknown } = { op: "select", count: false };
    const b: Record<string, unknown> = {};
    for (const m of ["not", "is", "in", "lte", "gte", "order", "or", "limit"]) b[m] = () => b;
    b.select = (_cols: string, opts?: { count?: string }) => { if (opts?.count) ctx.count = true; return b; };
    b.eq = (_col: string, value: unknown) => { if (ctx.op === "update") ctx.id = value; return b; };
    b.update = (values: Record<string, unknown>) => { ctx.op = "update"; ctx.values = values; return b; };
    b.then = (resolve: (v: unknown) => void) => {
      if (ctx.op === "update") {
        state.updates.push({ table, values: ctx.values!, id: ctx.id });
        return resolve({ error: null });
      }
      if (ctx.count) return resolve({ count: state.countToday, error: null });
      return resolve({ data: table === "outreach" ? state.rows : [], error: null });
    };
    return b;
  }
  return { supabase: { from: (t: string) => builder(t) } };
});
vi.mock("../resend", () => ({
  sendOutreachEmail: async (to: string, subject: string, body: string) => { state.sent.push({ to, subject, body }); },
}));
vi.mock("../unsubscribe", () => ({ createUnsubscribeToken: async () => "tok" }));
vi.mock("../template", async () => {
  const actual = await vi.importActual<typeof import("../template")>("../template");
  return {
    ...actual,
    getTemplate: async (key: string) =>
      key.includes("bad")
        ? { subject: "Hello {{empresa}}", body: "Olá {{empresa}}, o site (Request failed with status code 403)" }
        : { subject: "Hi {{empresa}}", body: "Hi {{empresa}}, we build websites in {{cidade}}." },
  };
});

import { sendPendingOutreach } from "../send-outreach";

const row = (id: string, category: string, name = `Lead ${id}`) => ({
  id, lead_id: `l${id}`, email: `${id}@empresa.com`,
  leads: { name, category, address: "55 NE 5th St, Miami, FL 33132, USA", country: "US", website: "https://x.com" },
});

beforeEach(() => { state.rows = []; state.updates = []; state.sent = []; state.countToday = 0; });

describe("sendPendingOutreach (fluxo real, banco e Resend simulados)", () => {
  it("barra o e-mail ruim, envia os bons e nao deixa o barrado ocupar a vaga", async () => {
    state.rows = [row("1", "bad"), row("2", "ok"), row("3", "ok")];
    process.env.SEND_DAILY_LIMIT = "80";
    const result = await sendPendingOutreach(2, undefined, Infinity, "US");

    expect(result.blocked).toBe(1);
    expect(result.sent).toBe(2); // limite 2 preenchido pelos bons, apesar do barrado na frente
    expect(state.sent.map((s) => s.to)).toEqual(["2@empresa.com", "3@empresa.com"]);
    const blockedUpdate = state.updates.find((u) => String(u.values.notes ?? "").startsWith("Bloqueado"));
    expect(blockedUpdate?.id).toBe("1");
  });

  it("e-mail enviado leva rodape com identificacao e link de descadastro", async () => {
    state.rows = [row("2", "ok")];
    await sendPendingOutreach(5, undefined, Infinity, "US");
    expect(state.sent[0].body).toContain("DevzDesign");
    expect(state.sent[0].body).toContain("unsubscribe");
    expect(state.sent[0].body).toContain("in Miami");
  });

  it("nada barrado: conta normal e marca como contatado", async () => {
    state.rows = [row("2", "ok")];
    const result = await sendPendingOutreach(5, undefined, Infinity, "US");
    expect(result).toMatchObject({ sent: 1, failed: 0, blocked: 0 });
    expect(state.updates.some((u) => u.values.status === "contacted" && u.id === "2")).toBe(true);
  });

  it("cota do dia esgotada: nao envia nada", async () => {
    state.countToday = 80;
    state.rows = [row("2", "ok")];
    const result = await sendPendingOutreach(5, undefined, Infinity, "US");
    expect(result.sent).toBe(0);
    expect(state.sent).toEqual([]);
  });
});
