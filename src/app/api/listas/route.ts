import { rota } from "@/lib/api";
import { importarJcr, importarQualis, importarQualisColado, lerPlanilha } from "@/lib/planilhas";
import { aplicarListasEmTodas } from "@/lib/metricasAuto";

/** Recebe a planilha oficial do Qualis ou do JCR (formulário com arquivo). */
export const POST = rota(async (req, { ctx }) => {
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const tipo = String(form.get("tipo") ?? "");
  if (tipo === "qualis_colado") {
    const n = importarQualisColado(String(form.get("texto") ?? ""), String(form.get("periodo") ?? ""), String(form.get("area") ?? ""));
    const revistas = aplicarListasEmTodas(ctx.donoId);
    return { mensagem: `${n.toLocaleString("pt-BR")} classificações Qualis importadas. ${revistas} revista(s) suas foram atualizadas.` };
  }
  if (!(arquivo instanceof File) || !arquivo.size) return Response.json({ erro: "Escolha o arquivo." }, { status: 400 });
  if (arquivo.size > 60 * 1024 * 1024) return Response.json({ erro: "Arquivo grande demais (máximo 60 MB)." }, { status: 400 });
  const linhas = await lerPlanilha(Buffer.from(await arquivo.arrayBuffer()), arquivo.name);
  let descricao: string;
  if (tipo === "qualis") {
    const n = importarQualis(linhas, String(form.get("periodo") ?? ""), arquivo.name);
    descricao = `${n.toLocaleString("pt-BR")} classificações Qualis importadas`;
  } else if (tipo === "jcr") {
    const r = importarJcr(linhas, arquivo.name);
    descricao = `${r.linhas.toLocaleString("pt-BR")} ISSNs do JCR ${r.ano} importados`;
  } else return Response.json({ erro: "Tipo de lista inválido." }, { status: 400 });
  const revistas = aplicarListasEmTodas(ctx.donoId);
  return { mensagem: `${descricao}. ${revistas} revista(s) suas foram atualizadas.` };
});
