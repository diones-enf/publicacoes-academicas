import { cookies } from "next/headers";
import { cadastrarAutor, entrar, existeAlgumAutor } from "@/lib/auth";
import { corpo, respostaDeErro } from "@/lib/api";
import { COOKIE_SESSAO, opcoesCookie } from "@/lib/sessao";

/** Primeiro acesso: cria a conta do autor principal (só quando ainda não existe nenhuma). */
export async function POST(req: Request) {
  try {
    if (existeAlgumAutor()) return Response.json({ erro: "A conta do autor principal já foi criada." }, { status: 403 });
    const d = await corpo<Record<string, unknown>>(req);
    const { codigoRecuperacao } = await cadastrarAutor({
      cpf: String(d.cpf ?? ""),
      senha: String(d.senha ?? ""),
      nome: String(d.nome ?? ""),
      nomesCitacao: String(d.nomesCitacao ?? "").split(/[\n;]+/),
      orcid: d.orcid as string,
      lattesId: d.lattesId as string,
      email: d.email as string,
      dataNascimento: String(d.dataNascimento ?? ""),
      consentimento: d.consentimento === true,
    });
    const { token } = await entrar(String(d.cpf), String(d.senha));
    (await cookies()).set(COOKIE_SESSAO, token, opcoesCookie());
    return Response.json({ codigoRecuperacao });
  } catch (e) {
    return respostaDeErro(e);
  }
}
