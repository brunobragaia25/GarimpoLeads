import axios, { isAxiosError } from "axios";

// Evolution API (v2) rodando no Railway, conectada ao numero via QR code
// (WhatsApp Web por baixo, nao e a API oficial) - sem template aprovado nem
// janela de 24h, todo envio e texto livre.

// A mensagem padrao do axios ("Request failed with status code 400") esconde
// o motivo de verdade que a Evolution manda no corpo da resposta de erro -
// troca pela mensagem real pra facilitar diagnostico.
function rethrowWithEvolutionMessage(err: unknown): never {
  if (isAxiosError(err) && err.response?.data) {
    const data = err.response.data;
    const detail = data.response?.message ?? data.message ?? data.error;
    if (detail) {
      throw new Error(`Evolution API: ${Array.isArray(detail) ? JSON.stringify(detail) : String(detail)}`);
    }
  }
  throw err;
}

export function isEvolutionConfigured(): boolean {
  return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE);
}

function apiUrl(path: string): string {
  const base = process.env.EVOLUTION_API_URL!.replace(/\/+$/, "");
  return `${base}/${path}/${encodeURIComponent(process.env.EVOLUTION_INSTANCE!)}`;
}

function authHeaders() {
  return { apikey: process.env.EVOLUTION_API_KEY! };
}

// Sem timeout, uma chamada travada prende a funcao inteira do cron ate o
// limite de 300s da Vercel matar ela sem nunca gravar o log final - foi
// exatamente isso que pareceu ter acontecido num dia real de execucao.
const REQUEST_TIMEOUT_MS = 15_000;

// Telefone em E.164 sem "+" (ex: 5541999998888) - mesmo formato do numero
// que vem no remoteJid do webhook, entao a conversa ja fica gravada assim.
export function toWhatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// Celular BR antigo pode estar registrado no WhatsApp sem o 9 na frente
// (55 + DDD + 8 digitos) - o numero do webhook pode vir num formato e a
// conversa estar gravada no outro, entao a busca tenta as duas versoes.
export function brPhoneVariants(phone: string): string[] {
  if (/^55\d{2}9\d{8}$/.test(phone)) return [phone, phone.slice(0, 4) + phone.slice(5)];
  if (/^55\d{2}[6-9]\d{7}$/.test(phone)) return [phone, `${phone.slice(0, 4)}9${phone.slice(4)}`];
  return [phone];
}

// Confere se o numero tem WhatsApp antes de mandar - numero sem conta nao
// gasta envio (nem chama atencao do anti-spam com mensagem que nunca chega).
export async function hasWhatsappAccount(phone: string): Promise<boolean> {
  try {
    const { data } = await axios.post(
      apiUrl("chat/whatsappNumbers"),
      { numbers: [toWhatsappPhone(phone)] },
      { headers: authHeaders(), timeout: REQUEST_TIMEOUT_MS }
    );
    return data?.[0]?.exists === true;
  } catch (err) {
    rethrowWithEvolutionMessage(err);
  }
}

export async function sendWhatsappText(phone: string, body: string): Promise<string> {
  try {
    const { data } = await axios.post(
      apiUrl("message/sendText"),
      { number: toWhatsappPhone(phone), text: body },
      { headers: authHeaders(), timeout: REQUEST_TIMEOUT_MS }
    );

    return data?.key?.id ?? "";
  } catch (err) {
    rethrowWithEvolutionMessage(err);
  }
}
