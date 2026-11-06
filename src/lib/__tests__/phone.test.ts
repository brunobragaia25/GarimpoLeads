import { describe, expect, it } from "vitest";
import { hasUsablePhone, mobileStatus, phoneSearchRegex, whatsappLink } from "../phone";

describe("link do WhatsApp por pais", () => {
  it.each([
    ["BR", "(11) 91234-5678", "https://wa.me/5511912345678"],
    ["BR", "+55 11 91234-5678", "https://wa.me/5511912345678"],
    // DDD 55 (Santa Maria/RS) nao pode ser confundido com o DDI do Brasil
    ["BR", "(55) 99123-4567", "https://wa.me/5555991234567"],
    ["US", "(305) 555-1234", "https://wa.me/13055551234"],
    ["PT", "912 345 678", "https://wa.me/351912345678"],
    ["PT", "+351 912 345 678", "https://wa.me/351912345678"],
    ["UK", "020 7946 0958", "https://wa.me/442079460958"],
    ["UK", "07700 900123", "https://wa.me/447700900123"],
    ["UK", "+44 20 7946 0958", "https://wa.me/442079460958"],
  ] as const)("%s %s", (country, phone, expected) => {
    expect(whatsappLink(phone, country)).toBe(expected);
  });

  it("numero curto demais nao gera link", () => {
    expect(whatsappLink("1234", "BR")).toBeNull();
    expect(hasUsablePhone("912 345 678", "PT")).toBe(true);
    expect(hasUsablePhone("912 345 678", "BR")).toBe(false);
  });

  it("celular x fixo por pais (EUA nao da pra saber)", () => {
    expect(mobileStatus("(11) 91234-5678", "BR")).toBe(true);
    expect(mobileStatus("(51) 3233-2288", "BR")).toBe(false);
    expect(mobileStatus("912 345 678", "PT")).toBe(true);
    expect(mobileStatus("213 456 789", "PT")).toBe(false);
    expect(mobileStatus("07700 900123", "UK")).toBe(true);
    expect(mobileStatus("020 7946 0958", "UK")).toBe(false);
    expect(mobileStatus("(305) 555-1234", "US")).toBeNull();
  });
});

describe("busca por telefone", () => {
  const matches = (term: string, country: Parameters<typeof phoneSearchRegex>[1], stored: string) => {
    const re = phoneSearchRegex(term, country);
    return re !== null && new RegExp(re).test(stored);
  };

  it("ignora termo que nao e telefone", () => {
    expect(phoneSearchRegex("Pizzaria 123", "BR")).toBeNull();
    expect(phoneSearchRegex("123", "BR")).toBeNull();
  });

  it.each([
    ["BR", "11987654321", "(11) 98765-4321"],
    ["BR", "98765-4321", "(11) 98765-4321"],
    ["BR", "+55 11 98765-4321", "(11) 98765-4321"],
    ["BR", "5511987654321", "(11) 98765-4321"],
    ["BR", "(55) 99123-4567", "(55) 99123-4567"],
    ["US", "+1 305 555 1234", "(305) 555-1234"],
    ["US", "3055551234", "(305) 555-1234"],
    ["BRUS", "+1 (305) 555-1234", "(305) 555-1234"],
    ["PT", "+351 912 345 678", "912 345 678"],
    ["PT", "912345678", "912 345 678"],
    ["UK", "+44 20 7946 0958", "020 7946 0958"],
    ["UK", "02079460958", "020 7946 0958"],
    ["UK", "020 7946", "+44 20 7946 0958"],
    ["UK", "7946 0958", "020 7946 0958"],
  ] as const)("%s: %s acha %s", (country, term, stored) => {
    expect(matches(term, country, stored)).toBe(true);
  });

  it("nao acha numero diferente", () => {
    expect(matches("98765-4321", "BR", "(11) 98765-4329")).toBe(false);
  });
});
