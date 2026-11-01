// Ajudante para as rotas da API: confere a sessão e o perfil, e transforma
// erros em respostas JSON com mensagens em português.
import { ErroAcesso, type Usuario } from "./auth";
import { ErroDuplicidade, ErroValidacao, type Contexto } from "./publicacoes";
import { contextoDe, usuarioAtual } from "./sessao";

export interface ContextoRota {
  usuario: Usuario;
  ctx: Contexto;
  params: Record<string, string>;
}

type Manipulador = (req: Request, c: ContextoRota) => Promise<unknown> | unknown;

export function rota(fn: Manipulador, opcoes: { perfil?: "autor" | "qualquer" } = {}) {
  return async (req: Request, extra: { params: Promise<Record<string, string>> }) => {
    try {
      const usuario = await usuarioAtual();
      if (!usuario) return Response.json({ erro: "Sua sessão expirou. Entre de novo." }, { status: 401 });
      if ((opcoes.perfil ?? "autor") === "autor" && usuario.perfil !== "autor")
        return Response.json({ erro: "O leitor convidado só pode ver relatórios." }, { status: 403 });
      const params = (await extra?.params) ?? {};
      const r = await fn(req, { usuario, ctx: contextoDe(usuario), params });
      if (r instanceof Response) return r;
      return Response.json(r ?? { ok: true });
    } catch (e) {
      return respostaDeErro(e);
    }
  };
}

export function respostaDeErro(e: unknown): Response {
  if (e instanceof ErroDuplicidade) return Response.json({ erro: e.message, duplicatas: e.duplicatas }, { status: 409 });
  if (e instanceof ErroValidacao || e instanceof ErroAcesso) return Response.json({ erro: e.message }, { status: 400 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error(e);
  return Response.json({ erro: msg || "Erro inesperado." }, { status: 400 });
}

export async function corpo<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function numero(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ErroValidacao("Identificador inválido.");
  return n;
}
