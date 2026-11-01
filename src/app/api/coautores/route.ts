import { corpo, numero, rota } from "@/lib/api";
import { fundirCoautores, marcarNaoFundir } from "@/lib/coautores";

/** POST { acao: "fundir" | "nao_fundir", manter, remover } — confirmação de sugestões de fusão. */
export const POST = rota(async (req, { ctx }) => {
  const d = await corpo<{ acao: string; manter: number; remover: number }>(req);
  if (d.acao === "fundir") fundirCoautores(ctx.donoId, numero(d.manter), numero(d.remover));
  else if (d.acao === "nao_fundir") marcarNaoFundir(ctx.donoId, numero(d.manter), numero(d.remover));
  else return Response.json({ erro: "Ação inválida." }, { status: 400 });
});
