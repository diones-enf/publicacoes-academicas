import { numero, rota } from "@/lib/api";
import { excluirMetrica } from "@/lib/veiculos";

export const DELETE = rota((_req, { ctx, params }) => {
  excluirMetrica(ctx.donoId, numero(params.id));
});
