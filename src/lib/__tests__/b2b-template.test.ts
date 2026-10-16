import { describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn().mockResolvedValue({ data: null });
const chain: Record<string, unknown> = {};
chain.select = () => chain;
chain.eq = () => chain;
chain.is = () => chain;
chain.maybeSingle = maybeSingle;
vi.mock("../supabase", () => ({ supabase: { from: () => chain } }));
vi.mock("../app-settings", () => ({
  getB2bCategories: vi.fn(async () => ["Transportadoras"]),
}));

import { getNoSiteTemplates, getTemplate } from "../template";

describe("template B2B por categoria", () => {
  it("categoria marcada como B2B usa o pitch B2B (com site)", async () => {
    const t = await getTemplate("transportadoras", "BR");
    expect(t.body).toContain("sites institucionais para empresas que vendem para outras empresas");
  });

  it("categoria comum continua no padrao do pais", async () => {
    const t = await getTemplate("dentistas", "BR");
    expect(t.body).not.toContain("empresas que vendem para outras empresas");
  });

  it("sem site: B2B usa pitch proprio e as demais o padrao", async () => {
    const m = await getNoSiteTemplates(["Transportadoras", "dentistas"], "BR");
    expect(m.get("Transportadoras")!.body).toContain("ainda não tem site");
    expect(m.get("dentistas")!.body).not.toContain("empresas que vendem para outras empresas");
  });
});
