import { corpo, numero, rota } from "@/lib/api";
import { lancarCitacoesManual } from "@/lib/citacoes";

/** Lança à mão as citações do Google Acadêmico de uma publicação. */
export const POST = rota(async (req, { ctx }) => {
  const d = await corpo<{ publicacao_id: number; total: string | number; fonte?: string }>(req);
  lancarCitacoesManual(ctx.donoId, numero(d.publicacao_id), Number(String(d.total).trim()), d.fonte ?? "Google Acadêmico");
});
