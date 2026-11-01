import { corpo, rota } from "@/lib/api";
import { inserir } from "@/lib/db";

export const POST = rota(async (req, { ctx }) => {
  const d = await corpo<{ nome: string; filtros: string }>(req);
  if (!d.nome?.trim()) return Response.json({ erro: "Dê um nome à visão." }, { status: 400 });
  return { id: inserir("visao_salva", { dono_id: ctx.donoId, nome: d.nome.trim(), filtros: d.filtros ?? "" }) };
});
