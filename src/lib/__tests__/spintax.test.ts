import { describe, expect, it, vi } from "vitest";

vi.mock("../supabase", () => ({ supabase: {} }));

import { renderTemplate } from "../template";

const template = { subject: "{A|B|C} {{empresa}}", body: "{Oi!|Olá!|E aí!} sobre {{empresa}} em {{cidade}}. {x|y}" };

describe("variacoes {a|b|c} no template", () => {
  it("e estavel: o mesmo lead sempre cai na mesma versao", () => {
    const lead = { name: "Clínica Sorriso", category: "dentistas", address: "Rua A, 1 - Centro, Campinas - SP" };
    expect(renderTemplate(template, lead)).toEqual(renderTemplate(template, lead));
  });

  it("leads diferentes recebem versoes diferentes e mantem as variaveis {{x}}", () => {
    const bodies = new Set(
      Array.from({ length: 40 }, (_, i) =>
        renderTemplate(template, { name: `Empresa ${i}`, category: "x", address: null }).body.split(" sobre")[0]
      )
    );
    expect(bodies.size).toBeGreaterThan(1);
    const out = renderTemplate(template, { name: "Acme | tagline", category: "x", address: null });
    expect(out.body).toContain("sobre Acme em");
    expect(out.body).not.toMatch(/[{}|]/);
  });
});
