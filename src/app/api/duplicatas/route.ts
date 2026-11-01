import { corpo, numero, rota } from "@/lib/api";
import { descartarDuplicata, mesclarPublicacoes, vincularVersoes } from "@/lib/publicacoes";

/** Resolve uma possível duplicata: mesclar, manter as duas ou ligar como versões relacionadas. */
export const POST = rota(async (req, { ctx }) => {
  const d = await corpo<{ acao: string; a: number; b: number }>(req);
  const a = numero(d.a);
  const b = numero(d.b);
  if (d.acao === "mesclar") return { id: mesclarPublicacoes(ctx, a, b) };
  if (d.acao === "versoes") vincularVersoes(ctx, a, b);
  else if (d.acao === "manter") descartarDuplicata(ctx, a, b);
  else return Response.json({ erro: "Ação inválida." }, { status: 400 });
});
