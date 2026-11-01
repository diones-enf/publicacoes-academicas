import { corpo, numero, rota } from "@/lib/api";
import { salvarMetrica, type DadosMetrica } from "@/lib/veiculos";

export const POST = rota(async (req, { ctx, params }) => {
  const d = await corpo<DadosMetrica & { id?: number }>(req);
  return { id: salvarMetrica(ctx.donoId, numero(params.id), d, d.id ? numero(d.id) : undefined) };
});
