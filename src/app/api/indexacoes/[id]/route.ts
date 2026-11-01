import { numero, rota } from "@/lib/api";
import { excluirIndexacao } from "@/lib/veiculos";

export const DELETE = rota((_req, { ctx, params }) => {
  excluirIndexacao(ctx.donoId, numero(params.id));
});
