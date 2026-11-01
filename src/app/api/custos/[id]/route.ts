import { corpo, numero, rota } from "@/lib/api";
import { atualizarLancamento, excluirLancamento, type DadosLancamento } from "@/lib/custos";

export const PUT = rota(async (req, { ctx, params }) => {
  await atualizarLancamento(ctx.donoId, numero(params.id), await corpo<DadosLancamento>(req));
});
export const DELETE = rota((_req, { ctx, params }) => {
  excluirLancamento(ctx.donoId, numero(params.id));
});
