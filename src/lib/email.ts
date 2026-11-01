// Envio de e-mail opcional (recuperação de senha e lembretes). Só funciona
// se o SMTP estiver configurado no arquivo .env; sem isso, nada é enviado.
import nodemailer from "nodemailer";

export function emailConfigurado(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USUARIO && process.env.SMTP_SENHA);
}

export async function enviarEmail(para: string, assunto: string, texto: string): Promise<boolean> {
  if (!emailConfigurado()) return false;
  const porta = Number(process.env.SMTP_PORTA || 465);
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_SENHA },
  });
  try {
    await t.sendMail({ from: process.env.SMTP_USUARIO, to: para, subject: assunto, text: texto });
    return true;
  } catch (e) {
    console.error("Falha ao enviar e-mail:", (e as Error).message);
    return false;
  }
}
