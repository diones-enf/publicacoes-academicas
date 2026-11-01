import { corpo, numero, rota } from "@/lib/api";
import { salvarCoautor, type Coautor } from "@/lib/coautores";

export const PUT = rota(async (req, { ctx, params }) => {
  salvarCoautor(ctx.donoId, numero(params.id), await corpo<Partial<Coautor>>(req));
});
