import { numero, rota } from "@/lib/api";
import { marcarLembreteLido } from "@/lib/lembretes";

export const POST = rota((_req, { ctx, params }) => {
  marcarLembreteLido(ctx.donoId, numero(params.id));
});
