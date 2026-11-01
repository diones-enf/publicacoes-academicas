import { notFound } from "next/navigation";
import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { obterPublicacao } from "@/lib/publicacoes";
import { TIPO_TAXA_PUBLICACAO, TIPO_TAXA_SUBMISSAO } from "@/lib/constantes";
import type { Lancamento } from "@/lib/custos";
import { dadosDoFormulario } from "@/componentes/formulario/dadosForm";
import { FormularioPublicacao } from "@/componentes/formulario/FormularioPublicacao";
import { formVazio, taxaVazia, type FormPub, type TaxaForm } from "@/componentes/formulario/modelo";

function taxaDe(l: Lancamento | undefined, naoSei: number): TaxaForm {
  if (naoSei) return { ...taxaVazia(), nao_sei: true };
  if (!l) return taxaVazia();
  const parte = l.parte_autor_brl !== l.valor_brl ? String(Math.round((l.parte_autor_brl / (l.cotacao || 1)) * 100) / 100) : "";
  return {
    valor: String(l.valor).replace(".", ","),
    nao_sei: false,
    moeda: l.moeda,
    data_pagamento: l.data_pagamento ?? "",
    data_vencimento: l.data_vencimento ?? "",
    pagador: l.pagador,
    parte_autor: parte.replace(".", ","),
  };
}

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario("autor");
  const ctx = contextoDe(u);
  const id = Number((await params).id);
  const p = obterPublicacao(ctx.donoId, id);
  if (!p) notFound();
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const f: FormPub = {
    ...formVazio(String(p.tipo_id)),
    titulo: p.titulo, subtipo_id: s(p.subtipo_id), status: p.status, data_submissao: s(p.data_submissao),
    data_aceite: s(p.data_aceite), data_publicacao: s(p.data_publicacao), ano: s(p.ano), volume: s(p.volume),
    numero: s(p.numero), paginas: s(p.paginas), idioma: s(p.idioma), doi: s(p.doi), isbn: s(p.isbn), link: s(p.link),
    area_tematica: s(p.area_tematica), palavras_chave: s(p.palavras_chave), resumo: s(p.resumo), observacoes: s(p.observacoes),
    veiculo_nome: s(p.veiculo_nome), veiculo_issn: s(p.veiculo_issn ?? p.issn), veiculo_eissn: s(p.veiculo_eissn),
    veiculo_editora: s(p.veiculo_editora), evento_nome: s(p.evento_nome), evento_edicao: s(p.evento_edicao),
    evento_cidade: s(p.evento_cidade), evento_data: s(p.evento_data), evento_instituicao: s(p.evento_instituicao),
    editora: s(p.editora), edicao: s(p.edicao), cidade: s(p.cidade), livro_titulo: s(p.livro_titulo),
    organizadores: s(p.organizadores), modalidade: s(p.modalidade), premiacao: s(p.premiacao), instituicao: s(p.instituicao),
    registro: s(p.registro), papel_autor: s(p.papel_autor), id_submissao: s(p.id_submissao), link_sistema: s(p.link_sistema),
    rodada_revisao: s(p.rodada_revisao), prazo_resposta: s(p.prazo_resposta), editor_responsavel: s(p.editor_responsavel),
    autores: p.autores.map((a) => ({ nome: a.nome_exibido, orcid: a.orcid ?? "", correspondente: !!a.correspondente })),
    principal_idx: p.autores.findIndex((a) => a.eh_principal),
    taxa_submissao: taxaDe(p.lancamentos.find((l) => l.tipo === TIPO_TAXA_SUBMISSAO), p.taxa_submissao_nao_sei),
    taxa_publicacao: taxaDe(p.lancamentos.find((l) => l.tipo === TIPO_TAXA_PUBLICACAO), p.taxa_publicacao_nao_sei),
    origem: {},
  };
  return (
    <>
      <p><a href={`/publicacoes/${id}`}>← Voltar</a></p>
      <h1>Editar publicação</h1>
      <div className="cartao">
        <FormularioPublicacao inicial={f} id={id} {...dadosDoFormulario(ctx)} />
      </div>
    </>
  );
}
