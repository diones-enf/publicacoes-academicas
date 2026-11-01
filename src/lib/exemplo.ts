// Dados de exemplo para conhecer o sistema. Ficam marcados com [EXEMPLO]
// nas observações e podem ser apagados de uma vez.
import { executar, inserir, todos, transacao } from "./db";
import { criarPublicacao, mudarStatus, type Contexto, type DadosPublicacao } from "./publicacoes";
import { salvarIndexacao, salvarMetrica, encontrarOuCriarVeiculo } from "./veiculos";
import { subtipoPorNome, tipoPorChave } from "./tipos";
import { hojeIso, somarDias } from "./texto";

const MARCA = "[EXEMPLO]";

export function temDadosExemplo(donoId: number): boolean {
  return todos("SELECT 1 FROM publicacao WHERE dono_id = ? AND observacoes LIKE ? LIMIT 1", donoId, `${MARCA}%`).length > 0;
}

export function apagarDadosExemplo(donoId: number) {
  transacao(() => {
    executar("DELETE FROM publicacao WHERE dono_id = ? AND observacoes LIKE ?", donoId, `${MARCA}%`);
    executar("DELETE FROM coautor WHERE dono_id = ? AND id NOT IN (SELECT coautor_id FROM autoria WHERE coautor_id IS NOT NULL)", donoId);
    executar("DELETE FROM veiculo WHERE dono_id = ? AND id NOT IN (SELECT veiculo_id FROM publicacao WHERE veiculo_id IS NOT NULL) AND site = 'exemplo'", donoId);
    executar("DELETE FROM evento WHERE dono_id = ? AND id NOT IN (SELECT evento_id FROM publicacao WHERE evento_id IS NOT NULL)", donoId);
  });
}

export async function carregarDadosExemplo(ctx: Contexto) {
  const eu = ctx.principal.nomesCitacao[0] ?? ctx.principal.nome;
  const tipo = (c: string) => tipoPorChave(ctx.donoId, c)!.id;
  const sub = (c: string, nome: string) => subtipoPorNome(tipo(c), nome)?.id ?? null;
  const gratis = { valor: 0, nao_sei: false };
  const hoje = hojeIso();
  const ano = Number(hoje.slice(0, 4));

  const rev1 = encontrarOuCriarVeiculo(ctx.donoId, { nome: "Revista Exemplo de Enfermagem", issn: "0102-6933", eissn: "1983-1447", editora: "Editora Exemplo" });
  const rev2 = encontrarOuCriarVeiculo(ctx.donoId, { nome: "Revista Internacional Exemplo de Enfermagem", eissn: "2049-3630", editora: "Editora Exemplo Internacional" });
  const rev3 = encontrarOuCriarVeiculo(ctx.donoId, { nome: "Cadernos Exemplo de Saúde Coletiva", issn: "0104-0707" });
  for (const id of [rev1, rev2, rev3]) executar("UPDATE veiculo SET site = 'exemplo' WHERE id = ?", id);
  salvarMetrica(ctx.donoId, rev1, { indicador: "QUALIS", valor: "A2", area: "Enfermagem", periodo: "2021-2024", selo: "confirmado_oficial", fonte: "Sucupira" });
  salvarMetrica(ctx.donoId, rev1, { indicador: "QUALIS", valor: "A3", area: "Saúde Coletiva", periodo: "2021-2024", selo: "confirmado_oficial", fonte: "Sucupira" });
  salvarMetrica(ctx.donoId, rev1, { indicador: "SJR", valor: "0.35", periodo: String(ano - 1), selo: "informado_usuario" });
  salvarIndexacao(ctx.donoId, rev1, { base: "SciELO", selo: "confirmado_oficial" });
  salvarIndexacao(ctx.donoId, rev1, { base: "Scopus", selo: "informado_revista" });
  salvarMetrica(ctx.donoId, rev2, { indicador: "QUALIS", valor: "A1", area: "Enfermagem", periodo: "2021-2024", selo: "confirmado_oficial", fonte: "Sucupira" });
  salvarMetrica(ctx.donoId, rev2, { indicador: "JIF", valor: "3.1", periodo: String(ano - 1), selo: "confirmado_oficial", fonte: "JCR" });
  salvarMetrica(ctx.donoId, rev2, { indicador: "QUARTIL_JCR", valor: "Q1", periodo: String(ano - 1), selo: "confirmado_oficial", fonte: "JCR" });
  salvarIndexacao(ctx.donoId, rev2, { base: "WoS SCIE", selo: "confirmado_oficial" });
  salvarMetrica(ctx.donoId, rev3, { indicador: "QUALIS", valor: "B1", area: "Enfermagem", periodo: "2021-2024", selo: "informado_revista" });

  const base = (d: Partial<DadosPublicacao> & { titulo: string }): DadosPublicacao => ({
    tipo_id: tipo("artigo"),
    status: "Publicado",
    taxa_submissao: gratis,
    taxa_publicacao: gratis,
    idioma: "Português",
    ...d,
    observacoes: `${MARCA} ${d.observacoes ?? "Item de exemplo."}`,
  });

  const ids: number[] = [];
  const criar = async (d: DadosPublicacao) => {
    const id = await criarPublicacao(ctx, d, { ignorarDuplicidade: true });
    ids.push(id);
    return id;
  };

  await criar(base({
    titulo: "Cuidados de enfermagem ao paciente com sepse: revisão integrativa (exemplo)",
    subtipo_id: sub("artigo", "Revisão integrativa"),
    veiculo_id: rev1, data_submissao: `${ano - 1}-02-10`, data_aceite: `${ano - 1}-06-01`, data_publicacao: `${ano - 1}-09-15`,
    volume: "44", numero: "3", paginas: "e20230011", doi: "10.9999/exemplo.2023.001",
    autores: [{ nome: eu }, { nome: "SCHIAVÃO, L." }, { nome: "SOUZA, P. M." }],
    taxa_publicacao: { valor: 980, nao_sei: false, data_pagamento: `${ano - 1}-07-05` },
  }));
  const artigoUsd = await criar(base({
    titulo: "Intervenções de enfermagem em terapia intensiva: revisão sistemática (exemplo)",
    subtipo_id: sub("artigo", "Revisão sistemática"),
    veiculo_id: rev2, data_submissao: `${ano - 1}-08-01`, data_aceite: `${ano}-01-20`, data_publicacao: `${ano}-03-05`,
    volume: "12", paginas: "101-115", doi: "10.9999/exemplo.2024.002",
    autores: [{ nome: "SCHIAVAO, L." }, { nome: eu }, { nome: "LIMA, A. C." }, { nome: "SOUZA, P. M." }],
  }));
  // APC em dólar com cotação fixa (no uso real, a PTAX vem do Banco Central)
  executar("DELETE FROM lancamento_custo WHERE publicacao_id = ? AND tipo = 'Taxa de publicação (APC)'", artigoUsd);
  inserir("lancamento_custo", {
    dono_id: ctx.donoId, publicacao_id: artigoUsd, tipo: "Taxa de publicação (APC)", descricao: "cotação de exemplo",
    valor: 1200, moeda: "USD", cotacao: 5.1, cotacao_data: `${ano}-02-10`, valor_brl: 6120, parte_autor_brl: 3060,
    competencia: `${ano}-02`, data_pagamento: `${ano}-02-10`, pagador: "Coautores",
  });
  await criar(base({
    titulo: "Experiência de residentes na implantação de protocolo de sepse (exemplo)",
    subtipo_id: sub("artigo", "Relato de experiência"),
    veiculo_id: rev3, data_publicacao: `${ano}-05-20`, volume: "9", numero: "1", paginas: "45-52",
    autores: [{ nome: eu }, { nome: "LIMA, A. C." }],
  }));
  await criar(base({
    titulo: "Sepse na emergência: resumo expandido (exemplo)",
    tipo_id: tipo("anais"), subtipo_id: sub("anais", "Resumo expandido"),
    evento: { nome: "Congresso Brasileiro de Enfermagem (exemplo)", edicao: "75º", cidade: "Porto Alegre", data: `${ano - 1}-10-12` },
    data_publicacao: `${ano - 1}-10-12`, modalidade: "Oral", premiacao: "Menção honrosa",
    autores: [{ nome: eu }, { nome: "Luana Schiavão" }],
    taxa_submissao: { valor: 350, nao_sei: false, data_pagamento: `${ano - 1}-08-20` },
  }));
  await criar(base({
    titulo: "Enfermagem baseada em evidências (capítulo de exemplo)",
    tipo_id: tipo("capitulo"), subtipo_id: sub("capitulo", "Revisão narrativa/bibliográfica"),
    livro_titulo: "Práticas avançadas em enfermagem", organizadores: "COSTA, M.; ALVES, R.", editora: "Editora Exemplo", cidade: "São Paulo",
    isbn: "9788500000000", paginas: "33-58", data_publicacao: `${ano - 1}-04-01`,
    autores: [{ nome: eu }],
  }));
  await criar(base({
    titulo: "Por que a sepse ainda mata tanto no Brasil? (exemplo)",
    tipo_id: tipo("jornal"), subtipo_id: sub("jornal", "Artigo de opinião"),
    veiculo: { nome: "Jornal Exemplo", tipo: "jornal" }, data_publicacao: `${ano}-09-13`, link: "https://exemplo.com/opiniao",
    autores: [{ nome: eu }],
  }));
  // Submissões em andamento
  const emRevisao = await criar(base({
    titulo: "Fatores associados ao atraso no antibiótico em pacientes sépticos (exemplo)",
    subtipo_id: sub("artigo", "Original/pesquisa"), status: "Submetido", veiculo_id: rev2,
    data_submissao: somarDias(hoje, -60), id_submissao: "JEN-2026-0042",
    autores: [{ nome: eu }, { nome: "SCHIAVÃO, L." }, { nome: "LIMA, A. C." }],
    taxa_publicacao: { valor: 980, nao_sei: false, data_vencimento: somarDias(hoje, 40) },
  }));
  mudarStatus(ctx, emRevisao, "Em revisão", { data: somarDias(hoje, -10), prazo_resposta: somarDias(hoje, 5) });
  await criar(base({
    titulo: "Validação de escala de risco de deterioração clínica (exemplo)",
    subtipo_id: sub("artigo", "Original/pesquisa"), status: "Submetido", veiculo_id: rev1,
    data_submissao: somarDias(hoje, -120), autores: [{ nome: "SOUZA, P. M." }, { nome: eu }],
    taxa_publicacao: { valor: 0, nao_sei: true },
  }));
  await criar(base({
    titulo: "Educação permanente em sepse: ensaio (exemplo)",
    subtipo_id: sub("artigo", "Opinião/ensaio/reflexão"), status: "Em elaboração",
    autores: [{ nome: eu }], taxa_submissao: { valor: 0, nao_sei: true }, taxa_publicacao: { valor: 0, nao_sei: true },
  }));
  const recusado = await criar(base({
    titulo: "Mortalidade por sepse em hospitais de ensino (exemplo)",
    subtipo_id: sub("artigo", "Original/pesquisa"), status: "Submetido", veiculo_id: rev2,
    data_submissao: somarDias(hoje, -200), autores: [{ nome: eu }, { nome: "LIMA, A. C." }],
  }));
  mudarStatus(ctx, recusado, "Recusado", { data: somarDias(hoje, -150) });
  return ids.length;
}
