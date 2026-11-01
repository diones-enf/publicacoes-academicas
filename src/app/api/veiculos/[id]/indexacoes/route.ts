import { corpo, numero, rota } from "@/lib/api";
import { salvarIndexacao } from "@/lib/veiculos";

export const POST = rota(async (req, { ctx, params }) => {
  const d = await corpo<{ id?: number; base: string; situacao?: string; selo?: string; fonte?: string; conferido_em?: string }>(req);
  return { id: salvarIndexacao(ctx.donoId, numero(params.id), d, d.id ? numero(d.id) : undefined) };
});
