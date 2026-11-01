import { corpo, numero, rota } from "@/lib/api";
import { excluirVeiculo, salvarVeiculo, type DadosVeiculo } from "@/lib/veiculos";

export const PUT = rota(async (req, { ctx, params }) => ({ id: salvarVeiculo(ctx.donoId, await corpo<DadosVeiculo>(req), numero(params.id)) }));
export const DELETE = rota((_req, { ctx, params }) => {
  excluirVeiculo(ctx.donoId, numero(params.id));
});
