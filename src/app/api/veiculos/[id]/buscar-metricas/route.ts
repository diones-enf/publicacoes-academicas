import { numero, rota } from "@/lib/api";
import { buscarMetricasAutomaticas } from "@/lib/metricasAuto";

export const POST = rota(async (_req, { ctx, params }) => buscarMetricasAutomaticas(ctx.donoId, numero(params.id)));
