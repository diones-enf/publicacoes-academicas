import { corpo, numero, rota } from "@/lib/api";
import { desvincularVersoes, vincularVersoes } from "@/lib/publicacoes";

export const POST = rota(async (req, { ctx, params }) => {
  const { outro_id } = await corpo<{ outro_id: number }>(req);
  vincularVersoes(ctx, numero(params.id), numero(outro_id));
});

export const DELETE = rota(async (req, { ctx, params }) => {
  const { outro_id } = await corpo<{ outro_id: number }>(req);
  desvincularVersoes(ctx, numero(params.id), numero(outro_id));
});
