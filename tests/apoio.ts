import { vi } from "vitest";
import { usarBancoEmMemoria } from "@/lib/db";
import { cadastrarAutor, buscarUsuario, nomesCitacaoDe } from "@/lib/auth";
import type { Contexto, DadosPublicacao } from "@/lib/publicacoes";
import { tipoPorChave } from "@/lib/tipos";

process.env.CHAVE_SECRETA = "chave-de-teste";
process.env.PASTA_DADOS = "/tmp/publicacoes-teste";

export async function novoAmbiente(): Promise<Contexto> {
  usarBancoEmMemoria();
  const { id } = await cadastrarAutor({
    cpf: "529.982.247-25",
    senha: "839201",
    nome: "Daniela Rodrigues Rosa",
    nomesCitacao: ["ROSA, D. R.", "ROSA, DANIELA"],
    orcid: "0000-0002-1825-0097",
    email: "daniela@exemplo.com",
    dataNascimento: "1985-04-12",
    consentimento: true,
  });
  const u = buscarUsuario(id)!;
  return { donoId: id, usuarioId: id, principal: { nome: u.nome, orcid: u.orcid, nomesCitacao: nomesCitacaoDe(u) } };
}

export function artigo(ctx: Contexto, extra: Partial<DadosPublicacao> = {}): DadosPublicacao {
  return {
    titulo: "Cuidados de enfermagem na sepse: revisão integrativa",
    tipo_id: tipoPorChave(ctx.donoId, "artigo")!.id,
    status: "Publicado",
    data_publicacao: "2025-03-10",
    taxa_submissao: { valor: 0, nao_sei: false },
    taxa_publicacao: { valor: 0, nao_sei: false },
    autores: [{ nome: "Daniela R. Rosa" }, { nome: "Luana Schiavão" }],
    veiculo: { nome: "Revista Gaúcha de Enfermagem", issn: "0102-6933", eissn: "1983-1447" },
    ...extra,
  };
}

/** Substitui o fetch por respostas fixas, por trecho de URL. */
export function simularFetch(rotas: Record<string, unknown>) {
  const f = vi.fn(async (url: string) => {
    const chave = Object.keys(rotas).find((k) => String(url).includes(k));
    if (!chave) return new Response("não encontrado", { status: 404 });
    const corpo = rotas[chave];
    return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", f);
  return f;
}
