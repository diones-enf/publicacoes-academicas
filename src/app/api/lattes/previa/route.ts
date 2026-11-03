import crypto from "node:crypto";
import { rota } from "@/lib/api";
import { metaGravar } from "@/lib/db";
import { lerCurriculo, textoDoArquivoLattes } from "@/lib/lattes";
import { previaLattes } from "@/lib/importacaoLattes";

/** Lê o arquivo do Lattes e devolve a prévia. Nada é gravado nas publicações ainda. */
export const POST = rota(async (req, { ctx }) => {
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.size) return Response.json({ erro: "Escolha o arquivo do Lattes." }, { status: 400 });
  const cv = lerCurriculo(await textoDoArquivoLattes(Buffer.from(await arquivo.arrayBuffer()), arquivo.name));
  if (!cv.itens.length) return Response.json({ erro: "Não encontrei produções neste currículo." }, { status: 400 });
  const token = crypto.randomBytes(12).toString("hex");
  metaGravar(`previa_lattes_${ctx.donoId}_${token}`, JSON.stringify({ cv, arquivo: arquivo.name }));
  const previa = previaLattes(ctx.donoId, cv);
  return {
    token,
    nome: cv.nome,
    atualizadoEm: cv.atualizadoEm,
    itens: previa.map((p) => ({
      indice: p.indice,
      origem: p.item.origem,
      titulo: p.item.titulo,
      ano: p.item.ano,
      onde: p.item.veiculo ?? p.item.evento?.nome ?? p.item.livro_titulo ?? p.item.editora ?? null,
      doi: p.item.doi,
      situacao: p.situacao,
      existente: p.existente,
      acaoPadrao: p.acaoPadrao,
    })),
  };
});
