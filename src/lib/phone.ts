import { COUNTRIES, type Country } from "./countries";

// Celular BR: DDD (2 dígitos) + 9 dígitos começando com "9". Fixo tem só 8
// dígitos no número local. ATENÇÃO: isso é só um heurístico de exibição (o
// selo "fixo" no dashboard) - NÃO usar pra decidir se um número tem WhatsApp
// ou não. Muita empresa registra o WhatsApp Business num número com formato
// de linha fixa (VoIP, PABX virtual), que não segue o padrão de celular mas
// funciona normalmente. Ver hasUsablePhone() pra elegibilidade de envio.
export function isMobilePhone(phone: string | null, country: Country = "BR"): boolean {
  return mobileStatus(phone, country) === true;
}

// true = celular, false = fixo, null = nao da pra saber pelo formato (EUA:
// celular e fixo usam o mesmo formato). Usado so pro selo "fixo?".
// Numero so conta como "ja veio com DDI" se for mais longo que um numero
// local do pais - senao o DDD 55 (RS) seria confundido com o DDI 55.
function splitDdi(phone: string, country: Country): { hasDdi: boolean; local: string } {
  const { ddi, maxLocalDigits } = COUNTRIES[country];
  const digits = phone.replace(/\D/g, "");
  const hasDdi = digits.startsWith(ddi) && digits.length > maxLocalDigits;
  return { hasDdi, local: hasDdi ? digits.slice(ddi.length) : digits };
}

export function mobileStatus(phone: string | null, country: Country): boolean | null {
  if (!phone) return null;
  const { local } = splitDdi(phone, country);
  switch (country) {
    case "BR":
      return local.length === 11 && local[2] === "9";
    case "PT":
      // Celular: 9 digitos comecando em 9 (91, 92, 93, 96).
      return local.length === 9 && local[0] === "9";
    case "UK":
      // Celular: 07xxx (ou 7xxx sem o 0 de tronco).
      return local.startsWith("07") || (local.length === 10 && local[0] === "7");
    default:
      return null;
  }
}

// Elegibilidade real pra tentar WhatsApp: qualquer telefone com digitos
// suficientes pra formar um numero valido. Se o numero nao tiver WhatsApp de
// verdade, o envio so falha (sem custo, a Meta nao cobra por tentativa
// fracassada) - entao nao vale a pena travar isso pelo formato do numero.
export function hasUsablePhone(phone: string | null, country: Country = "BR"): boolean {
  if (!phone) return false;
  return phone.replace(/\D/g, "").length >= COUNTRIES[country].minPhoneDigits;
}

export function whatsappLink(phone: string | null, country: Country = "BR", prefilledText?: string): string | null {
  if (!phone || !hasUsablePhone(phone, country)) return null;
  const config = COUNTRIES[country];
  // O Google Places devolve o telefone no formato local, sem DDI - precisa
  // completar pro link do WhatsApp funcionar. No Reino Unido o numero local
  // tem o 0 de tronco, que sai no formato internacional (020... -> 4420...).
  const { local } = splitDdi(phone, country);
  const national = config.stripTrunkZero && local.startsWith("0") ? local.slice(1) : local;
  const base = `https://wa.me/${config.ddi}${national}`;
  return prefilledText ? `${base}?text=${encodeURIComponent(prefilledText)}` : base;
}
