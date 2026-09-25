import { describe, expect, it, vi } from "vitest";

vi.mock("../supabase", () => ({ supabase: {} }));

import { buildProblemSummaryForLocale, extractCity } from "../template";

const okSite = { performance_score: 95, is_slow: false, is_outdated: false, is_wordpress: false, notes: "Carregou em 300ms" };

describe("frase do problema do site", () => {
  it("cita tempo e nota reais, no idioma certo", () => {
    const a = { ...okSite, performance_score: 53, notes: "Carregou em 2400ms", is_wordpress: true };
    expect(buildProblemSummaryForLocale(a, "en")).toContain("takes 2.4 seconds");
    expect(buildProblemSummaryForLocale(a, "pt-BR")).toContain("2,4 segundos pra carregar");
    expect(buildProblemSummaryForLocale(a, "pt-PT")).toContain("2,4 segundos a carregar");
    expect(buildProblemSummaryForLocale(a, "pt-PT")).not.toMatch(/\bpra\b/);
  });

  it("site que bloqueou o robo (tudo nulo) cai na frase neutra, nunca acusa 'fora do ar'", () => {
    const blocked = { performance_score: null, is_slow: null, is_outdated: null, is_wordpress: null, is_broken: null, notes: "Site bloqueou a analise automatica (HTTP 403)" };
    for (const locale of ["en", "pt-BR", "pt-PT"] as const) {
      expect(buildProblemSummaryForLocale(blocked, locale)).not.toMatch(/fora do ar|não está no ar|nem está no ar|isn't loading/i);
    }
  });

  it("so afirma 'fora do ar' com motivo definitivo (DNS, conexao recusada, 404/5xx)", () => {
    const dns = { ...okSite, is_broken: true, broken_reason: "site fora do ar (getaddrinfo ENOTFOUND x.com)" };
    expect(buildProblemSummaryForLocale(dns, "en")).toBe("the site isn't loading");
    expect(buildProblemSummaryForLocale(dns, "pt-BR")).toBe("o site nem está no ar");
    const timeout = { ...okSite, is_broken: true, broken_reason: "site fora do ar (timeout of 8000ms exceeded)" };
    expect(buildProblemSummaryForLocale(timeout, "pt-BR")).not.toMatch(/no ar/);
  });

  it("nunca vaza texto tecnico de erro", () => {
    const weird = { ...okSite, is_broken: true, broken_reason: "site fora do ar (Request failed with status code 403)" };
    for (const locale of ["en", "pt-BR", "pt-PT"] as const) {
      expect(buildProblemSummaryForLocale(weird, locale)).not.toMatch(/Request failed|status code|ENOTFOUND/);
    }
  });

  it("problema vazio devolve frase neutra no idioma certo", () => {
    expect(buildProblemSummaryForLocale(null, "en")).toMatch(/things that could be improved/);
    expect(buildProblemSummaryForLocale(null, "pt-PT")).toMatch(/podiam ser melhorados/);
  });
});

describe("achado do PageSpeed (Lighthouse do Google)", () => {
  const ps = { ...okSite, ps_mobile_score: 34, ps_lcp_ms: 6234 };

  it("substitui a nota aproximada e cita nota + tempo reais, por idioma", () => {
    expect(buildProblemSummaryForLocale(ps, "en")).toBe("on mobile, Google rates the site 34/100 for speed and the main content takes 6.2 seconds to appear");
    expect(buildProblemSummaryForLocale(ps, "pt-BR")).toContain("nota 34 de 100");
    expect(buildProblemSummaryForLocale(ps, "pt-BR")).toContain("6,2 segundos");
    expect(buildProblemSummaryForLocale(ps, "pt-PT")).toContain("no telemóvel");
    expect(buildProblemSummaryForLocale(ps, "pt-PT")).toContain("6,2 segundos a aparecer");
  });

  it("site rapido no Google nao ganha frase de problema de velocidade", () => {
    const fast = { ...okSite, performance_score: 40, is_slow: true, ps_mobile_score: 96, ps_lcp_ms: 1200 };
    expect(buildProblemSummaryForLocale(fast, "en")).toBe("there are a few things that could be improved");
  });

  it("junta com WordPress", () => {
    const wp = { ...ps, is_wordpress: true };
    expect(buildProblemSummaryForLocale(wp, "en")).toContain(" and it's built on WordPress");
  });
});

describe("cidade extraida do endereco", () => {
  it.each([
    ["Rua X, 100 - Centro, Curitiba - PR, 80010-000, Brasil", "Curitiba"],
    ["55 NE 5th St, Miami, FL 33132, USA", "Miami"],
    ["Av. das Forças Armadas 61, 1600-082 Lisboa, Portugal", "Lisboa"],
    ["30-32 Chalton St, London NW1 1JB, UK", "London"],
    ["10 High St, Manchester M1 1AA, UK", "Manchester"],
  ])("%s -> %s", (address, city) => {
    expect(extractCity(address)).toBe(city);
  });
});
