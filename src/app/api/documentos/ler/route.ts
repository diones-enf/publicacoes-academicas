import fs from "node:fs";
import { rota } from "@/lib/api";
import { obterAnexo } from "@/lib/anexos";
import { lerDocumento } from "@/lib/leitorDocumento";
import { textoDeArquivo } from "@/lib/textoDeArquivo";

/** Lê um arquivo enviado, um anexo já guardado (anexo_id) ou um texto colado. Não grava nada. */
export const POST = rota(async (req, { ctx }) => {
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const anexoId = Number(form.get("anexo_id") ?? 0);
  let texto = String(form.get("texto") ?? "").trim();
  let nome = "texto colado";
  if (arquivo instanceof File && arquivo.size) {
    nome = arquivo.name;
    texto = await textoDeArquivo(arquivo.name, Buffer.from(await arquivo.arrayBuffer()));
  } else if (anexoId) {
    const a = obterAnexo(ctx.donoId, anexoId);
    if (!a || !fs.existsSync(a.caminho)) throw new Error("Anexo não encontrado.");
    nome = a.nome_original;
    texto = await textoDeArquivo(a.nome_original, fs.readFileSync(a.caminho));
  }
  if (texto.length < 20) throw new Error("Escolha um arquivo ou cole o texto do e-mail.");
  return { nome, leitura: lerDocumento(texto, ctx.donoId), previa: texto.slice(0, 4000) };
});
