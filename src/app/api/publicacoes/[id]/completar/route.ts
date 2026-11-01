import { numero, rota } from "@/lib/api";
import { buscarPorDoi } from "@/lib/busca";
import { mesclarDadosExternos, obterPublicacao } from "@/lib/publicacoes";

/** Consulta o DOI de novo e completa só os campos vazios. */
export const POST = rota(async (_req, { ctx, params }) => {
  const id = numero(params.id);
  const p = obterPublicacao(ctx.donoId, id);
  if (!p?.doi) return Response.json({ erro: "Esta publicação não tem DOI." }, { status: 400 });
  const r = await buscarPorDoi(ctx.donoId, p.doi);
  if ("erro" in r) return Response.json({ erro: r.erro }, { status: 400 });
  return mesclarDadosExternos(ctx, id, r.dados);
});
