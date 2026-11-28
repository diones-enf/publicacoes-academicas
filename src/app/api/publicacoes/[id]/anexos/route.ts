import { numero, rota } from "@/lib/api";
import { listarAnexos, salvarAnexo } from "@/lib/anexos";

export const GET = rota(async (_req, { ctx, params }) => listarAnexos(ctx.donoId, numero(params.id)));

/** Envia um ou mais arquivos (campo "arquivo"), com categoria e observação. */
export const POST = rota(async (req, { ctx, params }) => {
  const form = await req.formData();
  const arquivos = form.getAll("arquivo").filter((a): a is File => a instanceof File && a.size > 0);
  if (!arquivos.length) throw new Error("Escolha pelo menos um arquivo.");
  const categoria = String(form.get("categoria") ?? "Outro");
  const observacao = String(form.get("observacao") ?? "");
  const ids = [];
  for (const a of arquivos)
    ids.push(salvarAnexo(ctx.donoId, numero(params.id), { nome: a.name, conteudo: Buffer.from(await a.arrayBuffer()), tipo: a.type }, categoria, observacao));
  return { ids };
});
