// Celular BR: DDD (2 dígitos) + 9 dígitos começando com "9". Fixo tem só 8
// dígitos no número local. ATENÇÃO: isso é só um heurístico de exibição (o
// selo "fixo" no dashboard) - NÃO usar pra decidir se um número tem WhatsApp
// ou não. Muita empresa registra o WhatsApp Business num número com formato
// de linha fixa (VoIP, PABX virtual), que não segue o padrão de celular mas
// funciona normalmente. Ver hasUsablePhone() pra elegibilidade de envio.
export function isMobilePhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  return local.length === 11 && local[2] === "9";
}

// Elegibilidade real pra tentar WhatsApp: qualquer telefone com digitos
// suficientes pra formar um numero valido. Se o numero nao tiver WhatsApp de
// verdade, o envio so falha (sem custo, a Meta nao cobra por tentativa
// fracassada) - entao nao vale a pena travar isso pelo formato do numero.
export function hasUsablePhone(phone: string | null): boolean {
  if (!phone) return false;
  return phone.replace(/\D/g, "").length >= 10;
}

export function whatsappLink(phone: string | null, prefilledText?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  const base = `https://wa.me/${withCountryCode}`;
  return prefilledText ? `${base}?text=${encodeURIComponent(prefilledText)}` : base;
}
