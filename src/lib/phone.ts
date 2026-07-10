// Celular BR: DDD (2 dígitos) + 9 dígitos começando com "9". Fixo tem só 8
// dígitos no número local, então não recebe WhatsApp.
export function isMobilePhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  return local.length === 11 && local[2] === "9";
}

export function whatsappLink(phone: string | null, prefilledText?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  const base = `https://wa.me/${withCountryCode}`;
  return prefilledText ? `${base}?text=${encodeURIComponent(prefilledText)}` : base;
}
