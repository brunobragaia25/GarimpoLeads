import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// HTML simples (sem estilo de marketing) só pra permitir que o Resend
// injete o pixel de abertura e reescreva links pra rastrear clique - sem
// isso, emails em texto puro não têm como ser rastreados de jeito nenhum.
function textToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(/(https?:\/\/[^\s]+)/g, (url) => {
    // Tira pontuação/parênteses de fechamento que grudaram no fim da URL
    // (ex: "(https://site.com)" ou "https://site.com.").
    const match = url.match(/^(.*?)([).,;:!?\]]*)$/);
    const cleanUrl = match ? match[1] : url;
    const trailing = match ? match[2] : "";
    return `<a href="${cleanUrl}">${cleanUrl}</a>${trailing}`;
  });
  const withBreaks = linked.replace(/\n/g, "<br>\n");
  return `<div style="font-family: sans-serif; font-size: 14px; color: #111; white-space: normal;">${withBreaks}</div>`;
}

export async function sendOutreachEmail(to: string, subject: string, body: string) {
  const from = `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    text: body,
    html: textToHtml(body),
  });

  if (error) throw new Error(error.message);
}
