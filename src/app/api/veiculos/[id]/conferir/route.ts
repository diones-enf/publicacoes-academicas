import { numero, rota } from "@/lib/api";
import { executar } from "@/lib/db";
import { veiculoDoDono } from "@/lib/veiculos";
import { hojeIso } from "@/lib/texto";

/** Registra que você conferiu hoje todas as métricas e indexações desta revista. */
export const POST = rota((_req, { ctx, params }) => {
  const id = numero(params.id);
  if (!veiculoDoDono(ctx.donoId, id)) return Response.json({ erro: "Veículo não encontrado." }, { status: 404 });
  executar("UPDATE metrica_veiculo SET conferido_em = ? WHERE veiculo_id = ?", hojeIso(), id);
  executar("UPDATE indexacao_veiculo SET conferido_em = ? WHERE veiculo_id = ?", hojeIso(), id);
});
