// Critérios de aceite da Fase 1 (numeração da seção 14 do prompt).
import { afterEach, describe, expect, it, vi } from "vitest";
import { artigo, novoAmbiente, simularFetch } from "./apoio";
import { crossrefWork, openAlexWork } from "./fixtures";
import {
  criarPublicacao,
  desfazerUltimoStatus,
  ErroDuplicidade,
  mesclarDadosExternos,
  mudarStatus,
  obterPublicacao,
  ressubmeter,
} from "@/lib/publicacoes";
import { buscarPorAutor, buscarPorDoi } from "@/lib/busca";
import { listarPublicacoes } from "@/lib/filtros";
import { gerarRelatorio } from "@/lib/relatorios";
import { fundirCoautores, rankingCoautores, sugestoesDeFusao } from "@/lib/coautores";
import { salvarMetrica } from "@/lib/veiculos";
import { gerarLembretes, listarLembretes } from "@/lib/lembretes";
import { criarLancamento } from "@/lib/custos";
import { converterCrossref } from "@/lib/conectores/crossref";
import { hojeIso, somarDias } from "@/lib/texto";
import { tipoPorChave } from "@/lib/tipos";

afterEach(() => vi.unstubAllGlobals());

describe("2. Mesclar dados externos com mesmo DOI sem duplicar e sem apagar o que foi digitado", () => {
  it("completa só os campos vazios", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx, {
      titulo: "Meu título digitado à mão",
      doi: "10.1590/1983-1447.2023.20220123",
      volume: "99",
      observacoes: "anotação minha",
    }));
    const r = mesclarDadosExternos(ctx, id, converterCrossref(crossrefWork.message));
    const p = obterPublicacao(ctx.donoId, id)!;
    expect(p.titulo).toBe("Meu título digitado à mão");
    expect(p.volume).toBe("99");
    expect(p.observacoes).toBe("anotação minha");
    expect(p.numero).toBe("2");
    expect(p.paginas).toBe("e20220123");
    expect(r.divergentes).toContain("volume");
    expect(listarPublicacoes(ctx.donoId, {}, null)).toHaveLength(1);
    // a versão do Crossref fica guardada para mostrar lado a lado
    expect(p.origens.some((o) => o.campo === "volume" && o.valor === "44" && o.fonte === "Crossref")).toBe(true);
  });
  it("recusa cadastrar duas vezes o mesmo DOI", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx, { doi: "https://doi.org/10.1590/ABC" }));
    await expect(criarPublicacao(ctx, artigo(ctx, { titulo: "Outro", doi: "10.1590/abc" }))).rejects.toBeInstanceOf(ErroDuplicidade);
    await expect(criarPublicacao(ctx, artigo(ctx, { titulo: "Outro", doi: "10.1590/abc" }), { ignorarDuplicidade: true })).rejects.toBeInstanceOf(ErroDuplicidade);
  });
  it("título 90% parecido no mesmo ano vira aviso de possível duplicata", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx));
    await expect(criarPublicacao(ctx, artigo(ctx, { titulo: "Cuidados de enfermagem na sepse - revisão integrativa." }))).rejects.toThrow("possível duplicata");
    await expect(criarPublicacao(ctx, artigo(ctx, { titulo: "Cuidados de enfermagem na sepse - revisão integrativa." }), { ignorarDuplicidade: true })).resolves.toBeGreaterThan(0);
  });
});

describe("3. Taxa de R$ 0,00 é aceita, aparece como gratuito e entra no relatório", () => {
  it("aceita zero e diferencia de 'Ainda não sei'", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx));
    const p = obterPublicacao(ctx.donoId, id)!;
    expect(p.lancamentos).toHaveLength(2);
    expect(p.lancamentos.every((l) => l.valor === 0)).toBe(true);
    const rel = gerarRelatorio("custos", ctx.donoId, {}, {}, null)!;
    expect(rel.cartoes.find((c) => c.rotulo.startsWith("Publicações gratuitas"))!.valor).toBe("1");
    expect(rel.tabelas.find((t) => t.titulo.startsWith("Itens gratuitos"))!.linhas).toHaveLength(1);
    expect(listarPublicacoes(ctx.donoId, { custo: "gratuito" }, null)).toHaveLength(1);
  });
  it("não aceita taxa em branco sem 'Ainda não sei'", async () => {
    const ctx = await novoAmbiente();
    await expect(criarPublicacao(ctx, artigo(ctx, { taxa_publicacao: { valor: null, nao_sei: false } }))).rejects.toThrow("Ainda não sei");
    const id = await criarPublicacao(ctx, artigo(ctx, { taxa_publicacao: { valor: null, nao_sei: true } }));
    expect(obterPublicacao(ctx.donoId, id)!.taxa_publicacao_nao_sei).toBe(1);
  });
});

describe("4. Relatório por competência soma meses e moedas diferentes", () => {
  it("converte USD/EUR pela PTAX e soma por mês", async () => {
    const ctx = await novoAmbiente();
    simularFetch({
      "moeda='USD'": { value: [{ cotacaoVenda: 5.0, dataHoraCotacao: "2025-01-10 13:00:00.000", tipoBoletim: "Fechamento" }] },
      "moeda='EUR'": { value: [{ cotacaoVenda: 6.0, dataHoraCotacao: "2025-02-14 13:00:00.000", tipoBoletim: "Fechamento" }] },
    });
    const id = await criarPublicacao(ctx, artigo(ctx, {
      taxa_submissao: { valor: 100, nao_sei: false, moeda: "USD", data_pagamento: "2025-01-10" },
      taxa_publicacao: { valor: 200, nao_sei: false, moeda: "EUR", data_pagamento: "2025-02-14" },
    }));
    await criarLancamento(ctx.donoId, { publicacao_id: id, tipo: "Tradução", valor: 300, moeda: "BRL", data_pagamento: "2025-02-20" });
    await criarLancamento(ctx.donoId, { publicacao_id: id, tipo: "Revisão de língua", valor: 50, moeda: "BRL", competencia: "2025-01", data_pagamento: "2025-03-02" });
    const rel = gerarRelatorio("custos", ctx.donoId, {}, { criterio: "competencia" }, null)!;
    const mes = rel.tabelas.find((t) => t.titulo === "Total por mês")!;
    expect(mes.linhas).toEqual([
      ["01/2025", 550, 0, 550, 550],
      ["02/2025", 1500, 0, 1500, 1500],
    ]);
    expect(mes.totais).toEqual(["Total", 2050, 0, 2050, 2050]);
    // Por data de pagamento, a revisão de língua cai em março
    const caixa = gerarRelatorio("custos", ctx.donoId, {}, { criterio: "caixa" }, null)!;
    expect(caixa.tabelas.find((t) => t.titulo === "Total por mês")!.linhas.map((l) => l[0])).toEqual(["01/2025", "02/2025", "03/2025"]);
  });
  it("rateio: soma só a parte do autor principal", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx));
    await criarLancamento(ctx.donoId, { publicacao_id: id, tipo: "Outros", valor: 1000, parte_autor: 250, data_pagamento: "2025-05-05" });
    const rel = gerarRelatorio("custos", ctx.donoId, {}, {}, null)!;
    expect(rel.tabelas[0].totais).toEqual(["Total", 250, 0, 250, 1000]);
  });
});

describe("5. Ranking de coautores junta grafias diferentes após confirmação", () => {
  it("sugere, e só junta depois de confirmar", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx, { titulo: "Estudo A", autores: [{ nome: "ROSA, D. R." }, { nome: "SCHIAVÃO, L." }] }));
    await criarPublicacao(ctx, artigo(ctx, { titulo: "Estudo B", autores: [{ nome: "ROSA, D. R." }, { nome: "SCHIAVAO, L." }] }));
    await criarPublicacao(ctx, artigo(ctx, { titulo: "Estudo C", autores: [{ nome: "Rosa, Daniela" }, { nome: "Luana Schiavão" }] }));
    expect(rankingCoautores(ctx.donoId)).toHaveLength(3);
    const sug = sugestoesDeFusao(ctx.donoId);
    expect(sug.length).toBeGreaterThanOrEqual(2);
    for (const s of sugestoesDeFusao(ctx.donoId)) {
      const atual = sugestoesDeFusao(ctx.donoId).find((x) => x.a.id === s.a.id && x.b.id === s.b.id);
      if (atual) fundirCoautores(ctx.donoId, atual.a.id, atual.b.id);
    }
    const r = rankingCoautores(ctx.donoId);
    expect(r).toHaveLength(1);
    expect(r[0].trabalhos).toBe(3);
    expect(r[0].variacoes).toContain("SCHIAVAO");
  });
  it("reconhece o autor principal pelos nomes em citação e calcula o papel", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx, { autores: [{ nome: "Paulo Souza" }, { nome: "ROSA, D." }, { nome: "Ana Lima" }] }));
    const p = obterPublicacao(ctx.donoId, id)!;
    expect(p.autores.find((a) => a.eh_principal)?.ordem).toBe(2);
    expect(p.papel_autor).toBe("Coautor");
    const id2 = await criarPublicacao(ctx, artigo(ctx, { titulo: "Solo", autores: [{ nome: "Daniela Rodrigues Rosa" }] }));
    expect(obterPublicacao(ctx.donoId, id2)!.papel_autor).toBe("Autor único");
  });
});

describe("7. Atualizar o JIF de uma revista atualiza todos os artigos dela", () => {
  it("as métricas pertencem ao veículo", async () => {
    const ctx = await novoAmbiente();
    const a = await criarPublicacao(ctx, artigo(ctx, { titulo: "Artigo 1" }));
    await criarPublicacao(ctx, artigo(ctx, { titulo: "Artigo 2 diferente", veiculo: { nome: "Rev Gaúcha Enferm", issn: "1983-1447" } }));
    const veiculoId = Number(obterPublicacao(ctx.donoId, a)!.veiculo_id);
    salvarMetrica(ctx.donoId, veiculoId, { indicador: "JIF", valor: "1,2", periodo: "2023" });
    expect(listarPublicacoes(ctx.donoId, {}, null).map((l) => l.metricas?.jif)).toEqual([1.2, 1.2]);
    salvarMetrica(ctx.donoId, veiculoId, { indicador: "JIF", valor: "1.5", periodo: "2023" });
    expect(listarPublicacoes(ctx.donoId, {}, null).map((l) => l.metricas?.jif)).toEqual([1.5, 1.5]);
    expect(listarPublicacoes(ctx.donoId, { jif_min: "1.4" }, null)).toHaveLength(2);
  });
  it("usa o Qualis da área de referência", async () => {
    const ctx = await novoAmbiente();
    const a = await criarPublicacao(ctx, artigo(ctx));
    const v = Number(obterPublicacao(ctx.donoId, a)!.veiculo_id);
    salvarMetrica(ctx.donoId, v, { indicador: "QUALIS", valor: "a2", area: "Enfermagem", periodo: "2017-2020" });
    salvarMetrica(ctx.donoId, v, { indicador: "QUALIS", valor: "B1", area: "Interdisciplinar", periodo: "2017-2020" });
    expect(listarPublicacoes(ctx.donoId, {}, "Enfermagem")[0].metricas?.qualis).toBe("A2");
    expect(listarPublicacoes(ctx.donoId, {}, "Interdisciplinar")[0].metricas?.qualis).toBe("B1");
    expect(listarPublicacoes(ctx.donoId, { qualis: ["A1", "A2"] }, "Enfermagem")).toHaveLength(1);
  });
});

describe("8. Colar um DOI preenche o cadastro em até 5 segundos e avisa duplicidade", () => {
  it("preenche título, autores, revista, ISSN, ano, volume e páginas", async () => {
    const ctx = await novoAmbiente();
    simularFetch({ "api.crossref.org/works/": crossrefWork, "api.openalex.org/works/": openAlexWork });
    const inicio = Date.now();
    const r = await buscarPorDoi(ctx.donoId, "https://doi.org/10.1590/1983-1447.2023.20220123");
    expect(Date.now() - inicio).toBeLessThan(5000);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.dados.titulo).toBe("Cuidados de enfermagem na sepse: revisão integrativa");
    expect(r.dados.autores?.map((a) => a.nome)).toEqual(["Daniela R. Rosa", "Luana Schiavão", "Paulo Souza"]);
    expect(r.dados.revista).toBe("Revista Gaúcha de Enfermagem");
    expect(r.dados.issn).toBe("0102-6933");
    expect(r.dados.eissn).toBe("1983-1447");
    expect(r.dados.ano).toBe(2023);
    expect(r.dados.volume).toBe("44");
    expect(r.dados.paginas).toBe("e20220123");
    expect(r.dados.palavras_chave).toEqual(["Sepse", "Enfermagem"]); // veio do OpenAlex
    expect(r.origem.titulo).toBe("Crossref");
    expect(r.origem.palavras_chave).toBe("OpenAlex");
    expect(r.subtipo_sugerido).toBe("Revisão integrativa");
    expect(r.duplicatas).toHaveLength(0);
  });
  it("DOI já cadastrado gera aviso", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx, { doi: "10.1590/1983-1447.2023.20220123" }));
    simularFetch({ "api.crossref.org/works/": crossrefWork });
    const r = await buscarPorDoi(ctx.donoId, "10.1590/1983-1447.2023.20220123");
    if ("erro" in r) throw new Error(r.erro);
    expect(r.duplicatas[0].motivo).toBe("doi");
  });
  it("cai para o DataCite quando o Crossref não conhece o DOI", async () => {
    const ctx = await novoAmbiente();
    simularFetch({
      "api.datacite.org/dois/": { data: { attributes: { doi: "10.5281/zenodo.1", titles: [{ title: "Protocolo X" }], creators: [{ name: "Rosa, Daniela", givenName: "Daniela", familyName: "Rosa" }], publisher: "Zenodo", publicationYear: 2024, types: { resourceTypeGeneral: "Report" } } } },
    });
    const r = await buscarPorDoi(ctx.donoId, "10.5281/zenodo.1");
    if ("erro" in r) throw new Error(r.erro);
    expect(r.fontes).toEqual(["DataCite"]);
    expect(r.dados.tipo_chave).toBe("tecnica");
  });
});

describe("9. Buscar pelo autor lista as publicações e marca as já cadastradas", () => {
  it("junta ORCID e OpenAlex e marca o que já existe", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx, { doi: "10.1590/1983-1447.2023.20220123", data_publicacao: "2023-05-15" }));
    simularFetch({
      "pub.orcid.org/v3.0/0000-0002-1825-0097/works": {
        group: [
          { "work-summary": [{ title: { title: { value: "Cuidados de enfermagem na sepse: revisão integrativa" } }, "external-ids": { "external-id": [{ "external-id-type": "doi", "external-id-value": "10.1590/1983-1447.2023.20220123" }] }, "journal-title": { value: "Rev Gaúcha Enferm" }, "publication-date": { year: { value: "2023" } } }] },
          { "work-summary": [{ title: { title: { value: "Outro trabalho novo" } }, "external-ids": { "external-id": [] }, "publication-date": { year: { value: "2024" } } }] },
        ],
      },
      "api.openalex.org/works?filter=author.orcid": { results: [openAlexWork] },
    });
    const { resultados } = await buscarPorAutor(ctx.donoId, "0000-0002-1825-0097");
    expect(resultados).toHaveLength(2);
    const ja = resultados.find((r) => r.doi === "10.1590/1983-1447.2023.20220123")!;
    expect(ja.cadastrado_id).toBe(id);
    expect(ja.fontes.sort()).toEqual(["ORCID", "OpenAlex"]);
    expect(resultados.find((r) => r.titulo === "Outro trabalho novo")!.cadastrado_id).toBeNull();
  });
});

describe("11. Marcar como Publicado tira de Submissões; desfazer devolve", () => {
  it("move entre seções levando o histórico", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx, { status: "Submetido", data_submissao: "2025-01-05", data_publicacao: null }));
    mudarStatus(ctx, id, "Em revisão", { data: "2025-03-01", prazo_resposta: "2025-03-30" });
    mudarStatus(ctx, id, "Aceito", { data: "2025-04-10" });
    expect(listarPublicacoes(ctx.donoId, { secao: "submissoes" }, null)).toHaveLength(1);
    mudarStatus(ctx, id, "Publicado", { data_publicacao: "2025-06-01", doi: "10.1590/novo.1" });
    expect(listarPublicacoes(ctx.donoId, { secao: "submissoes" }, null)).toHaveLength(0);
    const pub = listarPublicacoes(ctx.donoId, { secao: "publicados" }, null);
    expect(pub).toHaveLength(1);
    expect(pub[0].selo_novo).toBe(1);
    expect(pub[0].doi).toBe("10.1590/novo.1");
    expect(obterPublicacao(ctx.donoId, id)!.historico.map((h) => h.status)).toEqual(["Submetido", "Em revisão", "Aceito", "Publicado"]);
    expect(desfazerUltimoStatus(ctx, id)).toBe("Aceito");
    const volta = obterPublicacao(ctx.donoId, id)!;
    expect(volta.secao).toBe("submissoes");
    expect(volta.doi).toBeNull();
    expect(volta.selo_novo).toBe(0);
    expect(volta.historico.map((h) => h.status)).toEqual(["Submetido", "Em revisão", "Aceito"]);
  });
  it("ressubmissão guarda a sequência de revistas", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx, { status: "Submetido", data_submissao: "2025-01-05", data_publicacao: null }));
    mudarStatus(ctx, id, "Recusado", { data: "2025-02-01" });
    expect(listarPublicacoes(ctx.donoId, { secao: "encerrados" }, null)).toHaveLength(1);
    ressubmeter(ctx, id, { veiculo: { nome: "Texto & Contexto Enfermagem", issn: "0104-0707" }, data: "2025-02-10" });
    const p = obterPublicacao(ctx.donoId, id)!;
    expect(p.status).toBe("Submetido");
    expect(p.tentativas.map((t) => [t.nome_veiculo, t.desfecho])).toEqual([
      ["Revista Gaúcha de Enfermagem", "Recusado"],
      ["Texto & Contexto Enfermagem", null],
    ]);
  });
});

describe("12. Prazo de resposta a pareceres gera lembrete 7 e 2 dias antes", () => {
  it("cria um lembrete aos 7 dias e outro aos 2, sem repetir", async () => {
    const ctx = await novoAmbiente();
    const hoje = hojeIso();
    const prazo = somarDias(hoje, 7);
    const id = await criarPublicacao(ctx, artigo(ctx, { status: "Submetido", data_submissao: hoje, data_publicacao: null }));
    mudarStatus(ctx, id, "Em revisão", { prazo_resposta: prazo });
    expect(gerarLembretes(ctx.donoId, somarDias(hoje, -1))).toHaveLength(0); // faltam 8 dias
    expect(gerarLembretes(ctx.donoId, hoje)).toHaveLength(1); // faltam 7
    expect(gerarLembretes(ctx.donoId, somarDias(hoje, 1))).toHaveLength(0); // não repete
    expect(gerarLembretes(ctx.donoId, somarDias(hoje, 5))).toHaveLength(1); // faltam 2
    const l = listarLembretes(ctx.donoId);
    expect(l.map((x) => x.antecedencia)).toEqual([7, 2]);
    expect(l[0].mensagem).toContain("prazo de resposta");
  });
  it("avisa pagamento previsto e item parado há 90 dias", async () => {
    const ctx = await novoAmbiente();
    const hoje = hojeIso();
    const id = await criarPublicacao(ctx, artigo(ctx, {
      status: "Submetido",
      data_submissao: somarDias(hoje, -95),
      data_publicacao: null,
      taxa_publicacao: { valor: 980, nao_sei: false, data_vencimento: somarDias(hoje, 2) },
    }));
    const novos = gerarLembretes(ctx.donoId, hoje);
    expect(novos).toHaveLength(2);
    const tipos = listarLembretes(ctx.donoId).map((l) => l.tipo).sort();
    expect(tipos).toEqual(["pagamento", "sem_movimentacao"]);
    expect(id).toBeGreaterThan(0);
  });
});

describe("Relatórios e filtros", () => {
  it("gera todos os relatórios sem erro e referências ABNT/Vancouver", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx, { doi: "10.1590/x.1", volume: "44", numero: "2", paginas: "e20220123", subtipo_id: null }));
    for (const chave of ["custos", "submissoes", "coautores", "artigos", "anais", "relatos", "livros", "jornais", "indicadores", "qualidade", "referencias"])
      expect(gerarRelatorio(chave, ctx.donoId, {}, {}, null)).not.toBeNull();
    const abnt = gerarRelatorio("referencias", ctx.donoId, {}, { estilo: "abnt" }, null)!.referencias![0];
    expect(abnt).toBe("ROSA, D. R.; SCHIAVÃO, L. Cuidados de enfermagem na sepse: revisão integrativa. **Revista Gaúcha de Enfermagem**, v. 44, n. 2, e20220123, 2025. DOI: https://doi.org/10.1590/x.1.");
    const van = gerarRelatorio("referencias", ctx.donoId, {}, { estilo: "vancouver" }, null)!.referencias![0];
    expect(van).toBe("Rosa DR, Schiavão L. Cuidados de enfermagem na sepse: revisão integrativa. Revista Gaúcha de Enfermagem. 2025;44(2):e20220123. doi:10.1590/x.1");
  });
  it("busca livre ignora acentos e maiúsculas", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx));
    expect(listarPublicacoes(ctx.donoId, { q: "SEPSE revisao" }, null)).toHaveLength(1);
    expect(listarPublicacoes(ctx.donoId, { q: "schiavao" }, null)).toHaveLength(1);
    expect(listarPublicacoes(ctx.donoId, { q: "gaucha" }, null)).toHaveLength(1);
    expect(listarPublicacoes(ctx.donoId, { q: "inexistente" }, null)).toHaveLength(0);
  });
  it("filtra por tipo, papel e qualidade dos dados", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx));
    await criarPublicacao(ctx, { ...artigo(ctx, { titulo: "Livro sobre sepse" }), tipo_id: tipoPorChave(ctx.donoId, "livro")!.id, veiculo: null });
    expect(listarPublicacoes(ctx.donoId, { tipo_id: String(tipoPorChave(ctx.donoId, "livro")!.id) }, null)).toHaveLength(1);
    expect(listarPublicacoes(ctx.donoId, { papel: "Autor principal" }, null)).toHaveLength(2);
    expect(listarPublicacoes(ctx.donoId, { qualidade: "sem_doi" }, null)).toHaveLength(2);
    expect(listarPublicacoes(ctx.donoId, { qualidade: "sem_qualis" }, null)).toHaveLength(1);
  });
});

describe("Possível duplicata: mesclar, manter ou ligar como versões", () => {
  it("mescla levando custos e campos vazios", async () => {
    const { mesclarPublicacoes, descartarDuplicata } = await import("@/lib/publicacoes");
    const { possiveisDuplicatas } = await import("@/lib/filtros");
    const ctx = await novoAmbiente();
    const a = await criarPublicacao(ctx, artigo(ctx));
    const b = await criarPublicacao(ctx, artigo(ctx, { titulo: "Cuidados de enfermagem na sepse: revisão integrativa.", volume: "7", doi: "10.1234/x" }), { ignorarDuplicidade: true });
    expect(possiveisDuplicatas(ctx.donoId)).toHaveLength(1);
    mesclarPublicacoes(ctx, a, b);
    const p = obterPublicacao(ctx.donoId, a)!;
    expect(p.volume).toBe("7");
    expect(p.doi).toBe("10.1234/x");
    expect(p.lancamentos).toHaveLength(4);
    expect(listarPublicacoes(ctx.donoId, {}, null)).toHaveLength(1);
    const c = await criarPublicacao(ctx, artigo(ctx, { titulo: "Cuidados de enfermagem na sepse - revisão integrativa" }), { ignorarDuplicidade: true });
    expect(possiveisDuplicatas(ctx.donoId)).toHaveLength(1);
    descartarDuplicata(ctx, a, c);
    expect(possiveisDuplicatas(ctx.donoId)).toHaveLength(0);
  });
});

describe("Dados de exemplo", () => {
  it("carregam e são apagados sem afetar o resto", async () => {
    const { carregarDadosExemplo, apagarDadosExemplo, temDadosExemplo } = await import("@/lib/exemplo");
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx, { titulo: "Minha publicação real" }));
    const n = await carregarDadosExemplo(ctx);
    expect(n).toBeGreaterThan(8);
    expect(temDadosExemplo(ctx.donoId)).toBe(true);
    for (const chave of ["custos", "submissoes", "coautores", "artigos", "anais", "relatos", "livros", "jornais", "indicadores", "qualidade", "referencias"])
      expect(gerarRelatorio(chave, ctx.donoId, {}, {}, "Enfermagem")).not.toBeNull();
    expect(listarPublicacoes(ctx.donoId, { secao: "submissoes" }, null).length).toBeGreaterThanOrEqual(3);
    apagarDadosExemplo(ctx.donoId);
    expect(listarPublicacoes(ctx.donoId, {}, null).map((p) => p.titulo)).toEqual(["Minha publicação real"]);
  });
});
