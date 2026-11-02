import { obterPublicacao } from "@/lib/publicacoes";
import { buscarMetricasAutomaticas } from "@/lib/metricasAuto";
import { corpo, rota } from "@/lib/api";
import { criarPublicacao, type DadosPublicacao } from "@/lib/publicacoes";

export const POST = rota(async (req, { ctx }) => {
  const d = await corpo<DadosPublicacao & { ignorarDuplicidade?: boolean }>(req);
  const id = await criarPublicacao(ctx, d, { ignorarDuplicidade: !!d.ignorarDuplicidade });
  atualizarMetricasDaRevista(ctx.donoId, id);
  return { id };
});

/** Busca Qualis, JCR, Scopus e indexações da revista sem atrasar o salvamento. */
function atualizarMetricasDaRevista(donoId: number, id: number) {
  const v = obterPublicacao(donoId, id)?.veiculo_id;
  if (v) void buscarMetricasAutomaticas(donoId, v).catch(() => undefined);
}
