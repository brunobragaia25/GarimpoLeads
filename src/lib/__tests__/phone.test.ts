import { describe, expect, it } from "vitest";
import { hasUsablePhone, mobileStatus, whatsappLink } from "../phone";

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
