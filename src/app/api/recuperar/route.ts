import { gerarCodigoEmail, recuperarComCodigo, recuperarComCodigoEmail } from "@/lib/auth";
import { corpo, respostaDeErro } from "@/lib/api";
import { emailConfigurado, enviarEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const d = await corpo<{ modo: string; cpf: string; codigo?: string; senha?: string }>(req);
    if (d.modo === "codigo") {
      const novo = await recuperarComCodigo(d.cpf, d.codigo ?? "", d.senha ?? "");
      return Response.json({ ok: true, novoCodigo: novo });
    }
    if (d.modo === "email-enviar") {
      if (!emailConfigurado()) return Response.json({ erro: "O envio de e-mail não está configurado neste computador. Use o código de recuperação." }, { status: 400 });
      const r = await gerarCodigoEmail(d.cpf);
      // Resposta igual com ou sem conta, para não revelar quais CPFs existem.
      if (r) await enviarEmail(r.email, "Código para redefinir a senha", `Seu código é ${r.codigo}. Ele vale por 15 minutos.`);
      return Response.json({ ok: true });
    }
    if (d.modo === "email-confirmar") {
      await recuperarComCodigoEmail(d.cpf, d.codigo ?? "", d.senha ?? "");
      return Response.json({ ok: true });
    }
    return Response.json({ erro: "Pedido inválido." }, { status: 400 });
  } catch (e) {
    return respostaDeErro(e);
  }
}
