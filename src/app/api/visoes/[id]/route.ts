import { numero, rota } from "@/lib/api";
import { executar } from "@/lib/db";

export const DELETE = rota((_req, { ctx, params }) => {
  executar("DELETE FROM visao_salva WHERE id = ? AND dono_id = ?", numero(params.id), ctx.donoId);
});
