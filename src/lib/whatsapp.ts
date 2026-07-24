import axios, { isAxiosError } from "axios";

// A mensagem padrao do axios ("Request failed with status code 400") esconde
// o motivo de verdade que a Meta manda no corpo da resposta de erro - troca
// pela mensagem real pra facilitar diagnostico.
function rethrowWithMetaMessage(err: unknown): never {
  if (isAxiosError(err) && err.response?.data?.error?.message) {
    throw new Error(`Meta API: ${err.response.data.error.message}`);
  }
  throw err;
}

// v22.0 é a versão estável mais recente da Graph API no momento em que isso
// foi escrito; a Meta mantém versões antigas funcionando por um bom tempo,
// mas vale checar o changelog deles de vez em quando.
const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

function apiUrl(): string {
  return `${GRAPH_API_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

function authHeaders() {
  return { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` };
}

// Sem timeout, uma chamada travada na Meta prende a funcao inteira do cron
// ate o limite de 300s da Vercel matar ela sem nunca gravar o log final -
// foi exatamente isso que pareceu ter acontecido num dia real de execucao.
const REQUEST_TIMEOUT_MS = 15_000;

// Telefone precisa ir em E.164 sem "+" pra Graph API (ex: 5541999998888).
// Exportado porque o webhook recebe o "from" nesse mesmo formato da Meta -
// gravar a conversa já normalizada assim evita ter que casar formatos
// diferentes na hora de encontrar a conversa de uma mensagem recebida.
export function toWhatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export interface TemplateVariable {
  type: "text";
  text: string;
}

// Dispara um template aprovado pela Meta - único jeito de iniciar contato
// com quem nunca respondeu (mensagem de categoria "marketing", paga por
// envio). As variáveis preenchem os {{1}}, {{2}}... do corpo do template
// cadastrado no Meta Business, na ordem em que aparecem.
export async function sendWhatsappTemplate(
  phone: string,
  templateName: string,
  variables: string[]
): Promise<string> {
  try {
    const { data } = await axios.post(
      apiUrl(),
      {
        messaging_product: "whatsapp",
        to: toWhatsappPhone(phone),
        type: "template",
        template: {
          name: templateName,
          language: { code: "pt_BR" },
          components:
            variables.length > 0
              ? [
                  {
                    type: "body",
                    parameters: variables.map((text): TemplateVariable => ({ type: "text", text })),
                  },
                ]
              : undefined,
        },
      },
      { headers: authHeaders(), timeout: REQUEST_TIMEOUT_MS }
    );

    return data.messages?.[0]?.id ?? "";
  } catch (err) {
    rethrowWithMetaMessage(err);
  }
}

// Texto livre - só é aceito pela Meta dentro da janela de atendimento de
// 24h após o lead ter mandado a última mensagem (categoria "service",
// grátis). Fora da janela isso falha e precisa reabrir com template.
export async function sendWhatsappText(phone: string, body: string): Promise<string> {
  try {
    const { data } = await axios.post(
      apiUrl(),
      {
        messaging_product: "whatsapp",
        to: toWhatsappPhone(phone),
        type: "text",
        text: { body },
      },
      { headers: authHeaders(), timeout: REQUEST_TIMEOUT_MS }
    );

    return data.messages?.[0]?.id ?? "";
  } catch (err) {
    rethrowWithMetaMessage(err);
  }
}
