import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOutreachEmail(to: string, subject: string, body: string) {
  const from = `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    text: body,
  });

  if (error) throw new Error(error.message);
}
