import { rota } from "@/lib/api";
import { atualizarCitacoes } from "@/lib/citacoes";

/** Busca as citações agora (OpenAlex e Crossref) e grava a foto do mês. */
export const POST = rota(async (_req, { ctx }) => atualizarCitacoes(ctx.donoId));
