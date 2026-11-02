import { obterPublicacao } from "@/lib/publicacoes";
import { buscarMetricasAutomaticas } from "@/lib/metricasAuto";
import { corpo, numero, rota } from "@/lib/api";
import { atualizarPublicacao, excluirPublicacao, marcarComoVisto, type DadosPublicacao } from "@/lib/publicacoes";

export const PUT = rota(async (req, { ctx, params }) => {
  const d = await corpo<DadosPublicacao & { ignorarDuplicidade?: boolean }>(req);
  await atualizarPublicacao(ctx, numero(params.id), d, { ignorarDuplicidade: !!d.ignorarDuplicidade });
  atualizarMetricasDaRevista(ctx.donoId, numero(params.id));
  return { id: numero(params.id) };
});

export const DELETE = rota((_req, { ctx, params }) => {
  excluirPublicacao(ctx, numero(params.id));
});

/** PATCH: tira o selo "novo". */
export const PATCH = rota((_req, { ctx, params }) => {
  marcarComoVisto(ctx, numero(params.id));
});

/** Busca Qualis, JCR, Scopus e indexações da revista sem atrasar o salvamento. */
function atualizarMetricasDaRevista(donoId: number, id: number) {
  const v = obterPublicacao(donoId, id)?.veiculo_id;
  if (v) void buscarMetricasAutomaticas(donoId, v).catch(() => undefined);
}
