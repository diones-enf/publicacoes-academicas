// Ligação entre o login (auth.ts) e o Next.js: cookie de sessão e contexto.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { donoDe, nomesCitacaoDe, usuarioDaSessao, buscarUsuario, type Usuario } from "./auth";
import type { Contexto } from "./publicacoes";

export const COOKIE_SESSAO = "sessao_publicacoes";

export async function usuarioAtual(): Promise<Usuario | null> {
  const c = await cookies();
  return usuarioDaSessao(c.get(COOKIE_SESSAO)?.value);
}

/** Para páginas: exige login (e, se pedido, o perfil de autor). */
export async function exigirUsuario(perfil?: "autor"): Promise<Usuario> {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");
  if (perfil === "autor" && u.perfil !== "autor") redirect("/relatorios");
  return u;
}

export function contextoDe(u: Usuario): Contexto {
  const donoId = donoDe(u);
  const dono = donoId === u.id ? u : buscarUsuario(donoId)!;
  return {
    donoId,
    usuarioId: u.id,
    principal: { nome: dono.nome, orcid: dono.orcid, nomesCitacao: nomesCitacaoDe(dono) },
  };
}

/** Área Qualis de referência do autor dono dos dados. */
export function areaReferencia(u: Usuario): string | null {
  const donoId = donoDe(u);
  return donoId === u.id ? u.area_qualis_ref : (buscarUsuario(donoId)?.area_qualis_ref ?? null);
}

export function opcoesCookie() {
  return { httpOnly: true, sameSite: "strict" as const, path: "/", secure: false };
}
