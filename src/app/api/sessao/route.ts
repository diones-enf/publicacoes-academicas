import { cookies } from "next/headers";
import { encerrarTodasAsSessoes, entrar, sair } from "@/lib/auth";
import { corpo, respostaDeErro, rota } from "@/lib/api";
import { COOKIE_SESSAO, opcoesCookie } from "@/lib/sessao";

export async function POST(req: Request) {
  try {
    const { cpf, senha } = await corpo<{ cpf: string; senha: string }>(req);
    const { token } = await entrar(String(cpf ?? ""), String(senha ?? ""));
    (await cookies()).set(COOKIE_SESSAO, token, opcoesCookie());
    return Response.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE() {
  const c = await cookies();
  const token = c.get(COOKIE_SESSAO)?.value;
  if (token) sair(token);
  c.delete(COOKIE_SESSAO);
  return Response.json({ ok: true });
}

/** Encerra todas as sessões abertas do usuário (inclusive a atual). */
export const PATCH = rota(
  async (_req, { usuario }) => {
    encerrarTodasAsSessoes(usuario.id);
    (await cookies()).delete(COOKIE_SESSAO);
    return { ok: true };
  },
  { perfil: "qualquer" },
);
