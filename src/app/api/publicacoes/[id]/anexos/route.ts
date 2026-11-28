import { numero, rota } from "@/lib/api";
import { listarAnexos, salvarAnexo, alterarAnexo } from "@/lib/anexos";
import { lerDocumento, type LeituraDocumento } from "@/lib/leitorDocumento";
import { LEGIVEIS, textoDeArquivo } from "@/lib/textoDeArquivo";

export const GET = rota(async (_req, { ctx, params }) => listarAnexos(ctx.donoId, numero(params.id)));

/** Envia um ou mais arquivos (campo "arquivo"), com categoria e observação. */
export const POST = rota(async (req, { ctx, params }) => {
  const form = await req.formData();
  const arquivos = form.getAll("arquivo").filter((a): a is File => a instanceof File && a.size > 0);
  if (!arquivos.length) throw new Error("Escolha pelo menos um arquivo.");
  const categoria = String(form.get("categoria") ?? "Outro");
  const observacao = String(form.get("observacao") ?? "");
  const ids = [];
  const leituras: { anexoId: number; nome: string; leitura: LeituraDocumento }[] = [];
  for (const a of arquivos) {
    const conteudo = Buffer.from(await a.arrayBuffer());
    const auto = categoria === "auto";
    const id = salvarAnexo(ctx.donoId, numero(params.id), { nome: a.name, conteudo, tipo: a.type }, auto ? "Outro" : categoria, observacao);
    ids.push(id);
    // lê o documento: descobre o tipo (aceite, pareceres...) e o que pode ser preenchido
    if (LEGIVEIS.includes(a.name.split(".").pop()?.toLowerCase() ?? "")) {
      try {
        const leitura = lerDocumento(await textoDeArquivo(a.name, conteudo), ctx.donoId);
        if (auto && leitura.categoria !== "Outro") alterarAnexo(ctx.donoId, id, { categoria: leitura.categoria });
        if (leitura.status || leitura.idSubmissao || leitura.prazo || leitura.revista) leituras.push({ anexoId: id, nome: a.name, leitura });
      } catch {
        /* arquivo sem texto (ex.: PDF escaneado): fica só guardado */
      }
    }
  }
  return { ids, leituras };
});
