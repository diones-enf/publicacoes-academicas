import { corpo, numero, rota } from "@/lib/api";
import { buscarPorDoi } from "@/lib/busca";
import { mesclarDadosExternos, mudarStatus, obterPublicacao, type OpcoesStatus } from "@/lib/publicacoes";

/** Muda o status. Ao virar Publicado com DOI, completa os dados finais pela busca automática. */
export const POST = rota(async (req, { ctx, params }) => {
  const id = numero(params.id);
  const d = await corpo<OpcoesStatus & { status: string }>(req);
  mudarStatus(ctx, id, d.status, d);
  let completados: string[] = [];
  const p = obterPublicacao(ctx.donoId, id);
  if ((d.status === "Publicado" || d.status === "Apresentado") && p?.doi) {
    const r = await buscarPorDoi(ctx.donoId, p.doi).catch(() => null);
    if (r && !("erro" in r)) completados = mesclarDadosExternos(ctx, id, r.dados).preenchidos;
  }
  return { ok: true, completados };
});
