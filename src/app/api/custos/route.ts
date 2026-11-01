import { corpo, rota } from "@/lib/api";
import { criarLancamento, type DadosLancamento } from "@/lib/custos";

export const POST = rota(async (req, { ctx }) => ({ id: await criarLancamento(ctx.donoId, await corpo<DadosLancamento>(req)) }));
