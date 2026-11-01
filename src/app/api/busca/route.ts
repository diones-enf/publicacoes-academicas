import { rota } from "@/lib/api";
import { buscarPorAutor, buscarPorDoi, buscarPorIsbn, buscarPorTitulo } from "@/lib/busca";

/** GET /api/busca?modo=doi|autor|titulo|isbn&q=... */
export const GET = rota(async (req, { ctx }) => {
  const u = new URL(req.url);
  const modo = u.searchParams.get("modo");
  const q = (u.searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ erro: "Digite o que deseja buscar." }, { status: 400 });
  if (modo === "doi") return buscarPorDoi(ctx.donoId, q);
  if (modo === "isbn") return buscarPorIsbn(ctx.donoId, q);
  if (modo === "autor") return buscarPorAutor(ctx.donoId, q);
  if (modo === "titulo") return buscarPorTitulo(ctx.donoId, q);
  return Response.json({ erro: "Modo de busca inválido." }, { status: 400 });
});
