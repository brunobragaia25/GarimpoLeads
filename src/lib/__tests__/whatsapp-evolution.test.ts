import { afterEach, describe, expect, it, vi } from "vitest";
import { brPhoneVariants } from "../whatsapp";
import { phoneFromJids, toDeliveryStatus, verifyWhatsappWebhookToken } from "../whatsapp-webhook";

describe("brPhoneVariants", () => {
  it("celular com 9 tambem tenta sem o 9", () => {
    expect(brPhoneVariants("5511940438911")).toEqual(["5511940438911", "551140438911"]);
  });

  it("celular antigo sem 9 tambem tenta com o 9", () => {
    expect(brPhoneVariants("551198765432")).toEqual(["551198765432", "5511998765432"]);
  });

  it("fixo e numero de fora ficam como estao", () => {
    expect(brPhoneVariants("551133334444")).toEqual(["551133334444"]);
    expect(brPhoneVariants("14155550123")).toEqual(["14155550123"]);
  });
});

describe("phoneFromJids", () => {
  it("usa o primeiro jid de numero, pulando @lid", () => {
    expect(phoneFromJids("123456789@lid", "5511940438911@s.whatsapp.net")).toBe("5511940438911");
  });

  it("ignora grupo e jid sem numero", () => {
    expect(phoneFromJids("120363000000@g.us")).toBeNull();
    expect(phoneFromJids(undefined, "123@lid")).toBeNull();
  });

  it("remove o sufixo de dispositivo", () => {
    expect(phoneFromJids("5511940438911:12@s.whatsapp.net")).toBe("5511940438911");
  });
});

describe("toDeliveryStatus", () => {
  it("traduz o ack da Evolution", () => {
    expect(toDeliveryStatus("SERVER_ACK")).toBe("sent");
    expect(toDeliveryStatus("DELIVERY_ACK")).toBe("delivered");
    expect(toDeliveryStatus("READ")).toBe("read");
    expect(toDeliveryStatus("ERROR")).toBe("failed");
    expect(toDeliveryStatus("PENDING")).toBeNull();
    expect(toDeliveryStatus(undefined)).toBeNull();
  });
});

describe("verifyWhatsappWebhookToken", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("aceita so o token configurado", () => {
    vi.stubEnv("EVOLUTION_WEBHOOK_TOKEN", "segredo-123");
    expect(verifyWhatsappWebhookToken("segredo-123")).toBe(true);
    expect(verifyWhatsappWebhookToken("segredo-124")).toBe(false);
    expect(verifyWhatsappWebhookToken(null)).toBe(false);
  });

  it("recusa tudo sem token configurado", () => {
    vi.stubEnv("EVOLUTION_WEBHOOK_TOKEN", "");
    expect(verifyWhatsappWebhookToken("")).toBe(false);
  });
});
