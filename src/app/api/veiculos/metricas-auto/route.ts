import { rota } from "@/lib/api";
import { buscarMetricasDeTodas } from "@/lib/metricasAuto";

export const POST = rota(async (_req, { ctx }) => buscarMetricasDeTodas(ctx.donoId));
