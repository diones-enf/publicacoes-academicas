import { corpo, rota } from "@/lib/api";
import { criarPublicacao, type DadosPublicacao } from "@/lib/publicacoes";

export const POST = rota(async (req, { ctx }) => {
  const d = await corpo<DadosPublicacao & { ignorarDuplicidade?: boolean }>(req);
  const id = await criarPublicacao(ctx, d, { ignorarDuplicidade: !!d.ignorarDuplicidade });
  return { id };
});
