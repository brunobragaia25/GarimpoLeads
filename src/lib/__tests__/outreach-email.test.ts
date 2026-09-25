import { describe, expect, it, vi } from "vitest";

vi.mock("../supabase", () => ({ supabase: {} }));

import { buildOutreachEmail, checkEmailQuality, composeFooter } from "../outreach-email";
import { COUNTRY_CODES } from "../countries";

const template = {
  en: { subject: "A new version of {{empresa}}'s website", body: "Hi! I took a look at {{empresa}}'s website and noticed that {{problema}}. That could be turning away people searching for {{categoria}} in {{cidade}}." },
  pt: { subject: "Uma nova versão do site da {{empresa}}", body: "Olá! Dei uma olhada no site da {{empresa}} e reparei que {{problema}}. Isso pode afastar quem pesquisa por {{categoria}} em {{cidade}}." },
};
const analysis = { performance_score: 60, is_slow: false, is_outdated: false, is_wordpress: false, notes: "Carregou em 2000ms" };

describe("checagem de qualidade do e-mail", () => {
  it("barra variavel sem preencher", () => {
    expect(checkEmailQuality("Oi {{empresa}}", "US", "X").blocking).toHaveLength(1);
  });

  it("barra texto tecnico de erro", () => {
    expect(checkEmailQuality("o site (Request failed with status code 403)", "US", "X").blocking).toHaveLength(1);
  });

  it("barra portugues no meio de e-mail em ingles, mas ignora o nome do negocio", () => {
    expect(checkEmailQuality("the site isn't loading - site fora do ação", "US", "X").blocking).toHaveLength(1);
    expect(checkEmailQuality("Hi Ação Dental, hello", "US", "Ação Dental").blocking).toHaveLength(0);
  });

  it("barra ingles no meio de e-mail em portugues", () => {
    expect(checkEmailQuality("Olá, o site the loads and slow", "BR", "X").blocking).toHaveLength(1);
  });

  it("'em,' no meio da frase nao e cidade vazia (falso alarme em Portugal)", () => {
    expect(checkEmailQuality("têm interesse em, pelo menos, vê-la. Quem procura dentistas em Lisboa.", "PT", "X").warnings).toEqual([]);
    expect(checkEmailQuality("quem procura dentistas em .", "PT", "X").warnings.join()).toMatch(/cidade/);
    expect(checkEmailQuality("people searching for dentists in .", "US", "X").warnings.join()).toMatch(/cidade/);
  });

  it("avisa cidade vazia e palavra do BR em e-mail de Portugal", () => {
    expect(checkEmailQuality("quem procura dentistas em .", "PT", "X").warnings.join()).toMatch(/cidade/);
    expect(checkEmailQuality("Você pode ver", "PT", "X").warnings.join()).toMatch(/Brasil/);
  });
});

describe("e-mail montado", () => {
  it.each(COUNTRY_CODES)("%s: sai sem bloqueio, com cidade e rodape com identificacao", (country) => {
    const isEn = country === "US" || country === "UK";
    const address = { BR: "Rua X, 1 - Centro, Curitiba - PR, 80010-000, Brasil", US: "55 NE 5th St, Miami, FL 33132, USA", PT: "Av. X 61, 1600-082 Lisboa, Portugal", UK: "30 Chalton St, London NW1 1JB, UK" }[country];
    const email = buildOutreachEmail({
      template: isEn ? template.en : template.pt,
      country,
      unsubscribeLink: "https://app.example/unsub?x=1",
      lead: { name: "Clinica Teste", category: "dentistas", address },
      analysis,
    });
    expect(email.blocking).toEqual([]);
    expect(email.body).not.toMatch(/\{\{/);
    expect(email.body).toContain("DevzDesign");
    expect(email.body).toContain("https://app.example/unsub?x=1");
    expect(email.body).toContain("Google Maps");
  });

  it("nome com tagline depois do '|' e acento nao dispara falso alarme em e-mail em ingles", () => {
    const email = buildOutreachEmail({
      template: template.en,
      country: "US",
      unsubscribeLink: "L",
      lead: { name: "Clínica São Paulo Dental | Luxury Dentistry | Miami", category: "dentists", address: "55 NE 5th St, Miami, FL 33132, USA" },
      analysis,
    });
    expect(email.blocking).toEqual([]);
  });

  it("rodape de Portugal esta em portugues de Portugal", () => {
    expect(composeFooter("PT", "L")).toContain("Recebe esta mensagem");
    expect(composeFooter("BR", "L")).toContain("Você recebe esta mensagem");
    expect(composeFooter("UK", "L")).toContain("You're receiving this");
  });
});
