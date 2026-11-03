// Relatórios. Todos respeitam os filtros ativos e têm o mesmo formato
// (cartões + tabelas + gráfico), para exportar em PDF, XLSX e CSV.
import { listarPublicacoes, possiveisDuplicatas, type Filtros, type LinhaLista } from "./filtros";
import { listarLancamentos, proximosPagamentos } from "./custos";
import { rankingCoautores, redeColaboracao } from "./coautores";
import { referenciaAbnt, referenciaVancouver } from "./referencias";
import { resumoCitacoes } from "./citacoes";
import { resumoRevistasPorQualis } from "./veiculos";
import { competenciaBr, dataBr, diasEntre, reais } from "./texto";
import { ESTRATOS_QUALIS, STATUS_SUBMISSOES } from "./constantes";

export type Celula = string | number | null;
export interface Tabela {
  titulo: string;
  colunas: string[];
  linhas: Celula[][];
  totais?: Celula[];
  /** Colunas com valores em R$ (para formatar na tela e no Excel). */
  moeda?: number[];
}
export interface Grafico {
  titulo: string;
  rotulos: string[];
  series: { nome: string; valores: number[] }[];
  moeda?: boolean;
}
export interface Relatorio {
  chave: string;
  titulo: string;
  descricao: string;
  cartoes: { rotulo: string; valor: string }[];
  tabelas: Tabela[];
  graficos: Grafico[];
  referencias?: string[];
  rede?: ReturnType<typeof redeColaboracao>;
}

export const RELATORIOS: { chave: string; titulo: string; descricao: string }[] = [
  { chave: "custos", titulo: "Despesas e custos", descricao: "Por competência ou por data de pagamento, pago x pendente, médias e itens gratuitos." },
  { chave: "submissoes", titulo: "Submissões", descricao: "Itens em andamento por status e revista, tempos médios, taxa de aceite e pagamentos futuros." },
  { chave: "coautores", titulo: "Coautores", descricao: "Ranking de quem mais publicou com você e rede de colaboração." },
  { chave: "artigos", titulo: "Artigos", descricao: "Agrupados por subtipo, com Qualis, JCR, quartis, indexações, DOI e papel." },
  { chave: "anais", titulo: "Anais de eventos", descricao: "Trabalho completo, resumo expandido e resumo simples." },
  { chave: "relatos", titulo: "Relatos de experiência", descricao: "Em periódico e fora de periódico." },
  { chave: "livros", titulo: "Livros e capítulos", descricao: "Editora, ISBN, DOI, organizadores e páginas." },
  { chave: "jornais", titulo: "Jornais e divulgação", descricao: "Veículo, data e link." },
  { chave: "indicadores", titulo: "Indicadores do pesquisador", descricao: "Totais por ano, tipo e estrato Qualis, com/sem JCR e % como autor principal." },
  { chave: "revistas", titulo: "Revistas por Qualis", descricao: "Quantas revistas e publicações em cada estrato Qualis, por área de avaliação." },
  { chave: "qualidade", titulo: "Qualidade dos dados", descricao: "Itens sem DOI, sem Qualis, com métrica não confirmada ou possível duplicata." },
  { chave: "referencias", titulo: "Referências formatadas", descricao: "Lista em ABNT NBR 6023 ou Vancouver, pronta para currículo, edital ou memorial." },
];

export interface OpcoesRelatorio {
  criterio?: "competencia" | "caixa";
  mes_de?: string;
  mes_ate?: string;
  estilo?: "abnt" | "vancouver";
}

function arred(v: number) {
  return Math.round(v * 100) / 100;
}

function qualisTexto(l: LinhaLista): string {
  const m = l.metricas;
  if (!m?.qualis) return "";
  return `${m.qualis}${m.qualis_area ? ` (${m.qualis_area}${m.qualis_periodo ? `, ${m.qualis_periodo}` : ""})` : ""}`;
}

function agrupar<T>(itens: T[], chave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const i of itens) {
    const k = chave(i);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(i);
  }
  return m;
}

// ---------- Custos ----------

function relatorioCustos(donoId: number, f: Filtros, o: OpcoesRelatorio, area: string | null): Relatorio {
  const criterio = o.criterio ?? "competencia";
  const semDatas: Filtros = { ...f, de: undefined, ate: undefined, ano: undefined, quadrienio: undefined, semestre: undefined };
  const filtrando = Object.entries(semDatas).some(([, v]) => (Array.isArray(v) ? v.length : !!v));
  const pubs = listarPublicacoes(donoId, semDatas, area);
  const ids = filtrando ? pubs.map((p) => p.id) : null;
  const lanc = listarLancamentos(donoId, { de: o.mes_de, ate: o.mes_ate, criterio, publicacaoIds: ids });

  const somar = (lista: typeof lanc) => {
    const pago = lista.filter((l) => l.data_pagamento).reduce((s, l) => s + l.parte_autor_brl, 0);
    const pend = lista.filter((l) => !l.data_pagamento).reduce((s, l) => s + l.parte_autor_brl, 0);
    const total = lista.reduce((s, l) => s + l.valor_brl, 0);
    return [arred(pago), arred(pend), arred(pago + pend), arred(total)];
  };
  const tabelaPor = (titulo: string, nome: string, chave: (l: (typeof lanc)[number]) => string): Tabela => {
    const g = agrupar(lanc, chave);
    const linhas = [...g.entries()].map(([k, v]) => [k, ...somar(v)]).sort((a, b) => Number(b[3]) - Number(a[3]));
    return { titulo, colunas: [nome, "Pago (sua parte)", "Pendente (sua parte)", "Sua parte", "Valor total"], linhas, totais: ["Total", ...somar(lanc)], moeda: [1, 2, 3, 4] };
  };

  const porMes = agrupar(lanc, (l) => l.mes_ref);
  const meses = [...porMes.keys()].sort();
  const porAno = agrupar(lanc, (l) => l.mes_ref.slice(0, 4));

  const [pagoTotal, pendTotal, parteTotal] = somar(lanc);
  const pubsComLanc = new Set(lanc.map((l) => l.publicacao_id).filter(Boolean));
  const medio = pubsComLanc.size ? parteTotal / pubsComLanc.size : 0;

  // Custo médio por estrato Qualis
  const porPub = new Map<number, number>();
  for (const l of lanc) if (l.publicacao_id) porPub.set(l.publicacao_id, (porPub.get(l.publicacao_id) ?? 0) + l.parte_autor_brl);
  const pubMap = new Map(pubs.map((p) => [p.id, p]));
  const porEstrato = new Map<string, number[]>();
  for (const [pid, v] of porPub) {
    const e = pubMap.get(pid)?.metricas?.qualis ?? "Sem Qualis";
    if (!porEstrato.has(e)) porEstrato.set(e, []);
    porEstrato.get(e)!.push(v);
  }
  const ordemEstrato = [...ESTRATOS_QUALIS, "Sem Qualis"];
  const linhasEstrato = [...porEstrato.entries()]
    .sort((a, b) => ordemEstrato.indexOf(a[0]) - ordemEstrato.indexOf(b[0]))
    .map(([e, vs]) => [e, vs.length, arred(vs.reduce((s, v) => s + v, 0)), arred(vs.reduce((s, v) => s + v, 0) / vs.length)]);

  // Gratuito = todos os custos conhecidos são R$ 0 e nenhuma taxa está como "Ainda não sei".
  const gratuitos = ([...porPub.entries()].filter(([, v]) => v === 0).map(([pid]) => pubMap.get(pid)).filter(Boolean) as LinhaLista[]).filter(
    (p) => !p.taxa_submissao_nao_sei && !p.taxa_publicacao_nao_sei,
  );

  return {
    chave: "custos",
    titulo: `Despesas e custos por ${criterio === "caixa" ? "data de pagamento" : "competência"}`,
    descricao: "Valores em R$ (moedas estrangeiras convertidas pela PTAX do Banco Central). \"Sua parte\" considera o rateio entre coautores.",
    cartoes: [
      { rotulo: "Pago", valor: reais(pagoTotal) },
      { rotulo: "Pendente (compromissos)", valor: reais(pendTotal) },
      { rotulo: "Custo médio por publicação", valor: reais(medio) },
      { rotulo: "Publicações gratuitas (R$ 0)", valor: String(gratuitos.length) },
    ],
    graficos: [
      {
        titulo: "Gasto mensal",
        rotulos: meses.map(competenciaBr),
        series: [
          { nome: "Pago", valores: meses.map((m) => arred(porMes.get(m)!.filter((l) => l.data_pagamento).reduce((s, l) => s + l.parte_autor_brl, 0))) },
          { nome: "Pendente", valores: meses.map((m) => arred(porMes.get(m)!.filter((l) => !l.data_pagamento).reduce((s, l) => s + l.parte_autor_brl, 0))) },
        ],
        moeda: true,
      },
    ],
    tabelas: [
      { titulo: "Total por mês", colunas: ["Mês", "Pago (sua parte)", "Pendente (sua parte)", "Sua parte", "Valor total"], linhas: meses.map((m) => [competenciaBr(m), ...somar(porMes.get(m)!)]), totais: ["Total", ...somar(lanc)], moeda: [1, 2, 3, 4] },
      { titulo: "Total por ano", colunas: ["Ano", "Pago (sua parte)", "Pendente (sua parte)", "Sua parte", "Valor total"], linhas: [...porAno.keys()].sort().map((a) => [a, ...somar(porAno.get(a)!)]), moeda: [1, 2, 3, 4] },
      tabelaPor("Por tipo de taxa", "Tipo de taxa", (l) => l.tipo),
      tabelaPor("Por tipo de publicação", "Tipo de publicação", (l) => l.tipo_publicacao ?? "(sem publicação)"),
      tabelaPor("Por veículo", "Veículo", (l) => l.veiculo ?? "(sem veículo)"),
      tabelaPor("Por pagador", "Pagador", (l) => l.pagador),
      { titulo: "Custo médio por estrato Qualis", colunas: ["Estrato", "Publicações", "Sua parte", "Média por publicação"], linhas: linhasEstrato, moeda: [2, 3] },
      {
        titulo: "Lançamentos",
        colunas: ["Mês", "Publicação", "Tipo", "Valor original", "Cotação", "Valor (R$)", "Sua parte (R$)", "Pagamento", "Pagador"],
        linhas: lanc.map((l) => [
          competenciaBr(l.mes_ref),
          l.titulo ?? l.descricao ?? "",
          l.tipo,
          `${l.moeda} ${l.valor.toFixed(2).replace(".", ",")}`,
          l.moeda === "BRL" ? "" : `${l.cotacao.toFixed(4).replace(".", ",")}${l.cotacao_estimada ? " (estimada)" : ""}`,
          l.valor_brl,
          l.parte_autor_brl,
          l.data_pagamento ? dataBr(l.data_pagamento) : l.valor === 0 ? "—" : "Pendente",
          l.pagador,
        ]),
        moeda: [5, 6],
      },
      { titulo: "Itens gratuitos (R$ 0,00)", colunas: ["Título", "Tipo", "Veículo", "Ano"], linhas: gratuitos.map((p) => [p.titulo, p.tipo, p.veiculo ?? p.evento ?? "", p.ano]) },
    ],
  };
}

// ---------- Submissões ----------

function relatorioSubmissoes(donoId: number, f: Filtros, area: string | null): Relatorio {
  const todas = listarPublicacoes(donoId, { ...f, secao: "" }, area);
  const andamento = todas.filter((p) => p.secao === "submissoes");
  const porStatus = STATUS_SUBMISSOES.map((s) => [s, andamento.filter((p) => p.status === s).length]);
  const porRevista = [...agrupar(andamento, (p) => p.veiculo ?? p.evento ?? "(sem veículo)").entries()]
    .map(([k, v]) => [k, v.length, v.map((p) => p.status).join(", ")])
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const ateAceite = todas.filter((p) => p.data_submissao && p.data_aceite).map((p) => diasEntre(p.data_submissao!, p.data_aceite!));
  const atePub = todas.filter((p) => p.data_submissao && p.data_publicacao).map((p) => diasEntre(p.data_submissao!, p.data_publicacao!));
  const media = (l: number[]) => (l.length ? Math.round(l.reduce((s, v) => s + v, 0) / l.length) : null);
  const aceitos = todas.filter((p) => ["Aceito", "Publicado"].includes(p.status) && p.data_submissao).length;
  const recusados = todas.filter((p) => p.status === "Recusado").length;
  const taxa = aceitos + recusados ? Math.round((aceitos / (aceitos + recusados)) * 100) : null;
  const futuros = proximosPagamentos(donoId, 1000);
  return {
    chave: "submissoes",
    titulo: "Submissões em andamento",
    descricao: "Taxa de aceite = aceitos e publicados ÷ (aceitos, publicados e recusados), entre os itens com data de submissão.",
    cartoes: [
      { rotulo: "Em andamento", valor: String(andamento.length) },
      { rotulo: "Tempo médio até o aceite", valor: media(ateAceite) !== null ? `${media(ateAceite)} dias` : "—" },
      { rotulo: "Tempo médio até a publicação", valor: media(atePub) !== null ? `${media(atePub)} dias` : "—" },
      { rotulo: "Taxa de aceite", valor: taxa !== null ? `${taxa}%` : "—" },
    ],
    graficos: [{ titulo: "Itens por status", rotulos: STATUS_SUBMISSOES, series: [{ nome: "Itens", valores: porStatus.map((s) => Number(s[1])) }] }],
    tabelas: [
      { titulo: "Por status", colunas: ["Status", "Itens"], linhas: porStatus },
      { titulo: "Por revista ou evento", colunas: ["Veículo", "Itens", "Status"], linhas: porRevista },
      {
        titulo: "Itens em andamento",
        colunas: ["Título", "Veículo", "Status", "Submissão", "Dias sem movimentação", "Prazo de resposta"],
        linhas: andamento.map((p) => [p.titulo, p.veiculo ?? p.evento ?? "", p.status, dataBr(p.data_submissao), p.dias_parado, dataBr(p.prazo_resposta)]),
      },
      {
        titulo: "Compromissos de pagamento futuros",
        colunas: ["Publicação", "Tipo", "Previsão", "Valor (R$)"],
        linhas: futuros.map((l) => [l.titulo ?? "", l.tipo, l.data_vencimento ? dataBr(l.data_vencimento) : competenciaBr(l.competencia), l.parte_autor_brl]),
        moeda: [3],
      },
    ],
  };
}

// ---------- Por tipo ----------

function linhaArtigo(p: LinhaLista): Celula[] {
  const m = p.metricas;
  return [
    p.titulo,
    p.veiculo ?? "",
    p.ano,
    qualisTexto(p),
    m?.jif ?? "",
    m?.quartil_jcr ?? "",
    m?.quartil_scopus ?? "",
    m?.impacto2a ?? "",
    m?.indexacoes.join(", ") ?? "",
    p.doi ?? "",
    p.papel_autor ?? "",
  ];
}
const COLUNAS_ARTIGO = ["Título", "Revista", "Ano", "Qualis", "JIF", "Quartil JCR", "Quartil Scopus", "Impacto 2 anos (OpenAlex)", "Indexações", "DOI", "Papel"];

function porSubtipo(lista: LinhaLista[], colunas: string[], linha: (p: LinhaLista) => Celula[]): Tabela[] {
  return [...agrupar(lista, (p) => p.subtipo ?? "Sem subtipo").entries()].map(([s, v]) => ({
    titulo: `${s} (${v.length})`,
    colunas,
    linhas: v.map(linha),
  }));
}

function relatorioPorTipo(chave: string, donoId: number, f: Filtros, area: string | null): Relatorio {
  const base = listarPublicacoes(donoId, f, area);
  const info = RELATORIOS.find((r) => r.chave === chave)!;
  let tabelas: Tabela[] = [];
  if (chave === "artigos") {
    tabelas = porSubtipo(base.filter((p) => p.tipo_chave === "artigo"), COLUNAS_ARTIGO, linhaArtigo);
  } else if (chave === "anais") {
    tabelas = porSubtipo(
      base.filter((p) => p.tipo_chave === "anais"),
      ["Título", "Evento", "Data", "Cidade", "Modalidade", "Premiação", "Papel"],
      (p) => [p.titulo, p.evento ?? "", dataBr(p.evento_data ?? p.data_publicacao), p.evento_cidade ?? "", p.modalidade ?? "", p.premiacao ?? "", p.papel_autor ?? ""],
    );
  } else if (chave === "relatos") {
    const emPeriodico = base.filter((p) => p.tipo_chave === "artigo" && /relato de experi/i.test(p.subtipo ?? ""));
    const fora = base.filter((p) => p.tipo_chave === "relato");
    tabelas = [
      { titulo: `Em periódico (${emPeriodico.length})`, colunas: COLUNAS_ARTIGO, linhas: emPeriodico.map(linhaArtigo) },
      {
        titulo: `Fora de periódico (${fora.length})`,
        colunas: ["Título", "Subtipo", "Evento ou veículo", "Instituição", "Ano"],
        linhas: fora.map((p) => [p.titulo, p.subtipo ?? "", p.evento ?? p.veiculo ?? "", p.cidade ?? "", p.ano]),
      },
    ];
  } else if (chave === "livros") {
    const livros = base.filter((p) => p.tipo_chave === "livro");
    const caps = base.filter((p) => p.tipo_chave === "capitulo");
    tabelas = [
      {
        titulo: `Livros (${livros.length})`,
        colunas: ["Título", "Subtipo", "Editora", "ISBN", "DOI", "Edição", "Páginas", "Ano"],
        linhas: livros.map((p) => [p.titulo, p.subtipo ?? "", p.editora ?? p.veiculo_editora ?? "", p.isbn ?? "", p.doi ?? "", p.edicao ?? "", p.paginas ?? "", p.ano]),
      },
      {
        titulo: `Capítulos (${caps.length})`,
        colunas: ["Capítulo", "Livro", "Organizadores", "Editora", "ISBN", "DOI", "Páginas", "Ano"],
        linhas: caps.map((p) => [p.titulo, p.livro_titulo ?? "", p.organizadores ?? "", p.editora ?? "", p.isbn ?? "", p.doi ?? "", p.paginas ?? "", p.ano]),
      },
    ];
  } else if (chave === "jornais") {
    tabelas = [
      {
        titulo: "Jornais e revistas de divulgação",
        colunas: ["Título", "Subtipo", "Veículo", "Data", "Link"],
        linhas: base.filter((p) => p.tipo_chave === "jornal").map((p) => [p.titulo, p.subtipo ?? "", p.veiculo ?? "", dataBr(p.data_publicacao), p.link ?? ""]),
      },
    ];
  }
  const total = tabelas.reduce((s, t) => s + t.linhas.length, 0);
  return { chave, titulo: info.titulo, descricao: info.descricao, cartoes: [{ rotulo: "Itens", valor: String(total) }], tabelas, graficos: [] };
}

// ---------- Indicadores ----------

function relatorioIndicadores(donoId: number, f: Filtros, area: string | null): Relatorio {
  const pubs = listarPublicacoes(donoId, { ...f, secao: f.secao || "publicados" }, area);
  const anos = [...new Set(pubs.map((p) => p.ano).filter(Boolean) as number[])].sort();
  const tipos = [...new Set(pubs.map((p) => p.tipo))];
  const artigos = pubs.filter((p) => p.tipo_chave === "artigo");
  const comPapel = pubs.filter((p) => p.papel_autor);
  const principal = comPapel.filter((p) => p.papel_autor === "Autor principal").length;
  const estratos = [...ESTRATOS_QUALIS, "Sem Qualis"];
  const citOA = resumoCitacoes(donoId).atuais.find((a) => a.fonte === "OpenAlex");
  return {
    chave: "indicadores",
    titulo: "Indicadores do pesquisador",
    descricao: "Considera os itens publicados ou apresentados (ou a seção escolhida no filtro). Citações: última foto mensal do OpenAlex.",
    cartoes: [
      { rotulo: "Total", valor: String(pubs.length) },
      { rotulo: "Artigos", valor: String(artigos.length) },
      { rotulo: "Artigos com JCR", valor: String(artigos.filter((p) => p.metricas?.tem_jcr).length) },
      { rotulo: "Citações (OpenAlex)", valor: citOA?.total !== undefined ? `${citOA.total} · h ${citOA.h} · i10 ${citOA.i10}` : "—" },
      { rotulo: "Como autor principal", valor: comPapel.length ? `${Math.round((principal / comPapel.length) * 100)}%` : "—" },
    ],
    graficos: [{ titulo: "Publicações por ano", rotulos: anos.map(String), series: [{ nome: "Itens", valores: anos.map((a) => pubs.filter((p) => p.ano === a).length) }] }],
    tabelas: [
      {
        titulo: "Por ano e tipo",
        colunas: ["Ano", ...tipos, "Total"],
        linhas: anos.map((a) => [a, ...tipos.map((t) => pubs.filter((p) => p.ano === a && p.tipo === t).length), pubs.filter((p) => p.ano === a).length]),
        totais: ["Total", ...tipos.map((t) => pubs.filter((p) => p.tipo === t).length), pubs.length],
      },
      {
        titulo: `Artigos por estrato Qualis${area ? ` (${area})` : ""}`,
        colunas: ["Estrato", "Com JCR", "Sem JCR", "Total"],
        linhas: estratos
          .map((e) => {
            const l = artigos.filter((p) => (p.metricas?.qualis ?? "Sem Qualis") === e);
            return [e, l.filter((p) => p.metricas?.tem_jcr).length, l.filter((p) => !p.metricas?.tem_jcr).length, l.length];
          })
          .filter((r) => Number(r[3]) > 0),
      },
      {
        titulo: "Por papel do autor principal",
        colunas: ["Papel", "Itens"],
        linhas: [...agrupar(pubs, (p) => p.papel_autor ?? "Não identificado").entries()].map(([k, v]) => [k, v.length]),
      },
    ],
  };
}

// ---------- Qualidade dos dados ----------

function relatorioQualidade(donoId: number, f: Filtros, area: string | null): Relatorio {
  const pubs = listarPublicacoes(donoId, f, area);
  const limite = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const lista = (titulo: string, itens: LinhaLista[]): Tabela => ({
    titulo: `${titulo} (${itens.length})`,
    colunas: ["Título", "Tipo", "Veículo", "Ano", "Status"],
    linhas: itens.map((p) => [p.titulo, p.tipo, p.veiculo ?? p.evento ?? "", p.ano, p.status]),
  });
  const semDoi = pubs.filter((p) => !p.doi && ["artigo", "capitulo"].includes(p.tipo_chave) && p.secao === "publicados");
  const semQualis = pubs.filter((p) => p.tipo_chave === "artigo" && !p.metricas?.qualis);
  const semRevista = pubs.filter((p) => (p.tipo_chave === "artigo" || p.tipo_chave === "jornal") && !p.veiculo_id);
  const naoConf = pubs.filter((p) => p.metricas?.metrica_nao_confirmada);
  const velhas = pubs.filter((p) => p.veiculo_id && p.metricas && (!p.metricas.conferido_em || p.metricas.conferido_em < limite));
  const semPrincipal = pubs.filter((p) => p.total_autores > 0 && !p.posicao);
  const naoSei = pubs.filter((p) => p.taxa_submissao_nao_sei || p.taxa_publicacao_nao_sei);
  const dups = possiveisDuplicatas(donoId);
  return {
    chave: "qualidade",
    titulo: "Qualidade dos dados",
    descricao: "Itens que precisam de conferência.",
    cartoes: [
      { rotulo: "Sem DOI", valor: String(semDoi.length) },
      { rotulo: "Artigos sem Qualis", valor: String(semQualis.length) },
      { rotulo: "Métrica não confirmada", valor: String(naoConf.length) },
      { rotulo: "Possíveis duplicatas", valor: String(dups.length) },
    ],
    graficos: [],
    tabelas: [
      lista("Artigos sem revista ligada (não recebem Qualis, JCR nem Scopus)", semRevista),
      lista("Publicados sem DOI", semDoi),
      lista("Artigos sem Qualis", semQualis),
      lista("Com métrica não confirmada na fonte oficial", naoConf),
      lista("Métricas conferidas há mais de 12 meses", velhas),
      lista("Autor principal não identificado na lista de autores", semPrincipal),
      lista('Taxas marcadas como "Ainda não sei"', naoSei),
      {
        titulo: `Possíveis duplicatas (${dups.length})`,
        colunas: ["Título A", "Título B", "Ano", "Similaridade"],
        linhas: dups.map((d) => [d.a.titulo, d.b.titulo, d.a.ano ?? d.b.ano, `${Math.round(d.similaridade * 100)}%`]),
      },
    ],
  };
}

// ---------- Coautores ----------

function relatorioCoautores(donoId: number, f: Filtros, area: string | null): Relatorio {
  const filtrando = Object.entries(f).some(([, v]) => (Array.isArray(v) ? v.length : !!v));
  const ids = filtrando ? listarPublicacoes(donoId, f, area).map((p) => p.id) : null;
  const ranking = rankingCoautores(donoId, ids);
  return {
    chave: "coautores",
    titulo: "Coautores",
    descricao: "Grafias diferentes do mesmo coautor são somadas depois que você confirma a fusão (tela Coautores).",
    cartoes: [
      { rotulo: "Coautores", valor: String(ranking.length) },
      { rotulo: "Mais frequente", valor: ranking[0] ? `${ranking[0].nome} (${ranking[0].trabalhos})` : "—" },
    ],
    graficos: [],
    tabelas: [
      {
        titulo: "Ranking",
        colunas: ["#", "Coautor", "Trabalhos em comum", "Tipos", "Primeiro ano", "Último ano", "Instituição", "ORCID", "Outras grafias"],
        linhas: ranking.map((r, i) => [i + 1, r.nome, r.trabalhos, r.tipos, r.primeiro_ano, r.ultimo_ano, r.instituicao ?? "", r.orcid ?? "", r.variacoes ?? ""]),
      },
    ],
    rede: redeColaboracao(donoId, ids),
  };
}

// ---------- Referências ----------

function relatorioReferencias(donoId: number, f: Filtros, o: OpcoesRelatorio, area: string | null): Relatorio {
  const pubs = listarPublicacoes(donoId, { ...f, secao: f.secao || "publicados" }, area);
  const estilo = o.estilo ?? "abnt";
  const fmt = estilo === "vancouver" ? referenciaVancouver : referenciaAbnt;
  const refs = pubs.map(fmt).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    chave: "referencias",
    titulo: `Referências — ${estilo === "vancouver" ? "Vancouver" : "ABNT NBR 6023"}`,
    descricao: "Confira sempre antes de enviar: dados incompletos no cadastro aparecem entre colchetes.",
    cartoes: [{ rotulo: "Referências", valor: String(refs.length) }],
    graficos: [],
    tabelas: [{ titulo: "Referências", colunas: ["Referência"], linhas: refs.map((r) => [r.replace(/\*\*/g, "")]) }],
    referencias: refs,
  };
}

export function gerarRelatorio(chave: string, donoId: number, f: Filtros, o: OpcoesRelatorio, area: string | null): Relatorio | null {
  const r = gerarSemTotais(chave, donoId, f, o, area);
  if (r) for (const t of r.tabelas) adicionarTotais(t);
  return r;
}

/** Colunas que são contagens e podem ser somadas na linha de total. */
const SOMAVEIS = /^(itens|publica[cç][oõ]es|revistas|total|com jcr|sem jcr|trabalhos em comum)$/i;

/** Acrescenta a linha de total às tabelas que ainda não têm. */
function adicionarTotais(t: Tabela) {
  if (t.totais || !t.linhas.length) return;
  const somar = t.colunas.map((c, i) => i > 0 && (SOMAVEIS.test(c) || !!t.moeda?.includes(i)) && t.linhas.every((l) => typeof l[i] === "number" || l[i] === null));
  if (somar.some(Boolean)) {
    t.totais = t.colunas.map((_, i) => (i === 0 ? "Total" : somar[i] ? t.linhas.reduce((s, l) => s + (Number(l[i]) || 0), 0) : ""));
  } else {
    t.totais = t.colunas.map((_, i) => (i === 0 ? `Total: ${t.linhas.length} ${t.linhas.length === 1 ? "item" : "itens"}` : ""));
  }
}

function relatorioRevistas(donoId: number, area: string | null): Relatorio {
  const r = resumoRevistasPorQualis(donoId, area);
  return {
    chave: "revistas",
    titulo: "Revistas por Qualis",
    descricao: "Qualis mais recente de cada revista em cada área. Uma revista com Qualis em várias áreas aparece em cada uma delas.",
    cartoes: [
      { rotulo: "Revistas cadastradas", valor: String(r.totais.revistas) },
      { rotulo: "Publicações nessas revistas", valor: String(r.totais.publicacoes) },
      { rotulo: "Revistas sem Qualis", valor: String(r.totais.sem_qualis) },
    ],
    graficos: r.porEstrato.length
      ? [{ titulo: "Revistas por estrato (todas as áreas)", rotulos: r.porEstrato.map((e) => e.estrato), series: [{ nome: "Revistas", valores: r.porEstrato.map((e) => e.revistas) }] }]
      : [],
    tabelas: [
      {
        titulo: "Por área de avaliação e estrato",
        colunas: ["Área", "Estrato", "Revistas", "Publicações", "Quais revistas"],
        linhas: r.porArea.map((l) => [l.area, l.estrato, l.revistas, l.publicacoes, l.nomes]),
      },
      {
        titulo: `Por estrato (cada revista uma vez${area ? `, pelo Qualis de ${area}` : ", pelo melhor estrato"})`,
        colunas: ["Estrato", "Revistas", "Publicações"],
        linhas: [...r.porEstrato.map((e) => [e.estrato, e.revistas, e.publicacoes] as Celula[]), ["Sem Qualis", r.totais.sem_qualis, r.totais.pubs_sem_qualis]],
        totais: ["Total", r.totais.revistas, r.totais.publicacoes],
      },
    ],
  };
}

function gerarSemTotais(chave: string, donoId: number, f: Filtros, o: OpcoesRelatorio, area: string | null): Relatorio | null {
  switch (chave) {
    case "custos":
      return relatorioCustos(donoId, f, o, area);
    case "submissoes":
      return relatorioSubmissoes(donoId, f, area);
    case "coautores":
      return relatorioCoautores(donoId, f, area);
    case "artigos":
    case "anais":
    case "relatos":
    case "livros":
    case "jornais":
      return relatorioPorTipo(chave, donoId, f, area);
    case "indicadores":
      return relatorioIndicadores(donoId, f, area);
    case "qualidade":
      return relatorioQualidade(donoId, f, area);
    case "referencias":
      return relatorioReferencias(donoId, f, o, area);
    case "revistas":
      return relatorioRevistas(donoId, area);
    default:
      return null;
  }
}
