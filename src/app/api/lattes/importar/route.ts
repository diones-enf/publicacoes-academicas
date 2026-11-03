import { corpo, rota } from "@/lib/api";
import { executar, metaLer } from "@/lib/db";
import { importarLattes } from "@/lib/importacaoLattes";
import type { CurriculoLattes } from "@/lib/lattes";

export const POST = rota(async (req, { ctx }) => {
  const d = await corpo<{ token: string; decisoes: Record<number, "importar" | "completar" | "pular"> }>(req);
  const chave = `previa_lattes_${ctx.donoId}_${String(d.token ?? "").replace(/[^a-f0-9]/g, "")}`;
  const salvo = metaLer(chave);
  if (!salvo) return Response.json({ erro: "A prévia expirou. Envie o arquivo de novo." }, { status: 400 });
  const { cv, arquivo } = JSON.parse(salvo) as { cv: CurriculoLattes; arquivo: string };
  const r = await importarLattes(ctx, cv, d.decisoes ?? {}, arquivo);
  executar("DELETE FROM meta WHERE chave = ?", chave);
  return r;
});
