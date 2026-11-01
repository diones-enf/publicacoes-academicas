import { rota } from "@/lib/api";
import { apagarDadosExemplo, carregarDadosExemplo } from "@/lib/exemplo";

export const POST = rota(async (_req, { ctx }) => ({ criados: await carregarDadosExemplo(ctx) }));
export const DELETE = rota((_req, { ctx }) => {
  apagarDadosExemplo(ctx.donoId);
});
