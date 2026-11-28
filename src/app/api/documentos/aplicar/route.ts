import { rota } from "@/lib/api";
import { aplicarDocumento, type DadosDocumento } from "@/lib/aplicarDocumento";

/** Grava os dados conferidos pelo usuário. Campos: "dados" (JSON), "arquivo" (opcional), "anexo_id" (opcional). */
export const POST = rota(async (req, { ctx }) => {
  const form = await req.formData();
  const dados = JSON.parse(String(form.get("dados") ?? "{}")) as DadosDocumento;
  const arquivo = form.get("arquivo");
  return aplicarDocumento(
    ctx,
    dados,
    arquivo instanceof File && arquivo.size ? { nome: arquivo.name, conteudo: Buffer.from(await arquivo.arrayBuffer()), tipo: arquivo.type } : null,
    Number(form.get("anexo_id") ?? 0) || null,
  );
});
