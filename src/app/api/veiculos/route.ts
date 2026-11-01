import { corpo, rota } from "@/lib/api";
import { listarVeiculos, salvarVeiculo, type DadosVeiculo } from "@/lib/veiculos";

export const GET = rota((_req, { ctx }) => listarVeiculos(ctx.donoId));
export const POST = rota(async (req, { ctx }) => ({ id: salvarVeiculo(ctx.donoId, await corpo<DadosVeiculo>(req)) }));
