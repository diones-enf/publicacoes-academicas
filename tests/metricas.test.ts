import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { artigo, novoAmbiente, simularFetch } from "./apoio";
import { criarPublicacao, obterPublicacao } from "@/lib/publicacoes";
import { importarJcr, importarQualis, lerCsv, lerPlanilha } from "@/lib/planilhas";
import { aplicarListasEmTodas, buscarMetricasAutomaticas } from "@/lib/metricasAuto";
import { indexacoesDoVeiculo, metricasDoVeiculo } from "@/lib/veiculos";
import { limparCacheScimago } from "@/lib/conectores/scimago";
import { listarPublicacoes } from "@/lib/filtros";

afterEach(() => vi.unstubAllGlobals());

// Formato da exportação do Sucupira (latin-1, ponto e vírgula, área em maiúsculas)
const QUALIS = "ISSN;Título;Área de Avaliação;Estrato\n0102-6933;REVISTA GAÚCHA DE ENFERMAGEM;ENFERMAGEM;A2\n0102-6933;REVISTA GAÚCHA DE ENFERMAGEM;SAÚDE COLETIVA;A3\n1234-5679;OUTRA;ENFERMAGEM;B1\n";
// Exportação do JCR: linhas de título antes do cabeçalho
const JCR = `"Journal Data Filtered By:  Selected JCR Year: 2023 Selected Editions: SCIE Selected Categories: 'NURSING'"
"Journal name","JCR Abbreviation","Publisher","ISSN","eISSN","Category","Edition","Total Citations","2023 JIF","JIF Quartile","2023 JCI","5 Year JIF"
"Revista Gaucha de Enfermagem","REV GAUCHA ENFERM","UFRGS","0102-6933","1983-1447","NURSING","ESCI","500","0.9","Q3","0.40","1.1"
`;
const SCIMAGO = 'Rank;Sourceid;Title;Type;Issn;SJR;SJR Best Quartile;H index;Country\n1;123;"Revista Gaucha de Enfermagem";journal;"01026933, 19831447";0,412;Q2;30;Brazil\n';

describe("Qualis e JCR pelas planilhas oficiais", () => {
  it("importa o Qualis (CSV latin-1 do Sucupira) e aplica pelo ISSN", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx));
    const linhas = await lerPlanilha(Buffer.from(QUALIS, "latin1"), "qualis.csv");
    expect(importarQualis(linhas, "2021-2024", "qualis.csv")).toBe(3);
    expect(aplicarListasEmTodas(ctx.donoId)).toBe(1);
    const p = listarPublicacoes(ctx.donoId, {}, "Enfermagem")[0];
    expect(p.metricas?.qualis).toBe("A2");
    expect(p.metricas?.qualis_area).toBe("Enfermagem");
    expect(listarPublicacoes(ctx.donoId, {}, "Saúde Coletiva")[0].metricas?.qualis).toBe("A3");
    const m = metricasDoVeiculo(Number(obterPublicacao(ctx.donoId, id)!.veiculo_id));
    expect(m.every((x) => x.selo === "confirmado_oficial")).toBe(true);
  });
  it("importa o JCR mesmo com linhas de título antes do cabeçalho", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx));
    const r = importarJcr(lerCsv(JCR), "jcr.csv");
    expect(r).toEqual({ linhas: 2, ano: "2023" });
    aplicarListasEmTodas(ctx.donoId);
    const p = listarPublicacoes(ctx.donoId, {}, null)[0];
    expect(p.metricas?.jif).toBe(0.9);
    expect(p.metricas?.quartil_jcr).toBe("Q3");
    expect(p.metricas?.indexacoes).toContain("WoS ESCI");
  });
  it("recusa planilha que não é do Qualis", () => {
    expect(() => importarQualis([["Nome", "Idade"], ["a", "1"]], "2021-2024", "x.csv")).toThrow("colunas");
  });
});

describe("busca automática pela internet", () => {
  it("Scopus (SCImago), DOAJ, MEDLINE e SciELO pelo ISSN", async () => {
    const ctx = await novoAmbiente();
    fs.rmSync("/tmp/publicacoes-teste/referencias", { recursive: true, force: true });
    limparCacheScimago();
    simularFetch({
      "scimagojr.com": SCIMAGO,
      "doaj.org": { total: 1, results: [{}] },
      "eutils.ncbi.nlm.nih.gov": { esearchresult: { count: "0" } },
      "articlemeta.scielo.org": [{ v100: [{ _: "Rev Gaucha" }] }],
    });
    const id = await criarPublicacao(ctx, artigo(ctx));
    const v = Number(obterPublicacao(ctx.donoId, id)!.veiculo_id);
    const r = await buscarMetricasAutomaticas(ctx.donoId, v);
    expect(r.encontrados.sort()).toEqual(["DOAJ", "SciELO", expect.stringMatching(/^Scopus/)].sort());
    expect(indexacoesDoVeiculo(v).map((i) => i.base).sort()).toEqual(["DOAJ", "SciELO", "Scopus"]);
    const p = listarPublicacoes(ctx.donoId, {}, null)[0];
    expect(p.metricas?.sjr).toBe(0.412);
    expect(p.metricas?.quartil_scopus).toBe("Q2");
  });
  it("avisa quando a revista não tem ISSN", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx, { veiculo: { nome: "Sem ISSN" } }));
    const r = await buscarMetricasAutomaticas(ctx.donoId, Number(obterPublicacao(ctx.donoId, id)!.veiculo_id));
    expect(r.avisos[0]).toContain("ISSN");
  });
});

describe("Qualis colado da tela do Sucupira", () => {
  it("reconhece as linhas da tabela copiada (com tabulação)", async () => {
    const { importarQualisColado } = await import("@/lib/planilhas");
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx));
    const texto = [
      "Qualis Periódicos",
      "ISSN\tTítulo\tÁrea de Avaliação\tClassificação",
      "0102-6933\tREVISTA GAÚCHA DE ENFERMAGEM\tENFERMAGEM\tA2",
      "1983-1447\tREVISTA GAÚCHA DE ENFERMAGEM (ONLINE)\tENFERMAGEM\tA2",
      "Página 1 de 30",
    ].join("\n");
    expect(importarQualisColado(texto, "2021-2024", "Enfermagem")).toBe(2);
    aplicarListasEmTodas(ctx.donoId);
    expect(listarPublicacoes(ctx.donoId, {}, "Enfermagem")[0].metricas?.qualis).toBe("A2");
  });
  it("usa a área informada quando a linha não traz a área", async () => {
    const { importarQualisColado } = await import("@/lib/planilhas");
    await novoAmbiente();
    expect(importarQualisColado("0102-6933 REVISTA X B1", "2021-2024", "Enfermagem")).toBe(1);
    expect(() => importarQualisColado("nada aqui", "2021-2024", "Enfermagem")).toThrow("Não encontrei");
  });
});

describe("Qualis no artigo e na busca", () => {
  it("busca livre encontra pelo estrato e pela área do Qualis da revista", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx));
    await criarPublicacao(ctx, artigo(ctx, { titulo: "Outro artigo qualquer", veiculo: { nome: "Outra revista", issn: "1234-5679" } }));
    importarQualis(lerCsv(QUALIS), "2021-2024", "q.csv");
    aplicarListasEmTodas(ctx.donoId);
    expect(listarPublicacoes(ctx.donoId, { q: "A2" }, "Enfermagem").map((p) => p.titulo)).toEqual(["Cuidados de enfermagem na sepse: revisão integrativa"]);
    expect(listarPublicacoes(ctx.donoId, { q: "B1" }, "Enfermagem").map((p) => p.titulo)).toEqual(["Outro artigo qualquer"]);
    expect(listarPublicacoes(ctx.donoId, { q: "qualis enfermagem" }, "Enfermagem")).toHaveLength(2);
  });
});

describe("atualização pelo próprio sistema", () => {
  it("compara versões e grava o ZIP sem tocar nos dados", async () => {
    const { aplicarZip, eMaisNova } = await import("@/lib/atualizacao");
    expect(eMaisNova("8", "7")).toBe(true);
    expect(eMaisNova("7", "7")).toBe(false);
    expect(eMaisNova("10", "9")).toBe(true);
    expect(eMaisNova(null, "7")).toBe(false);
    const JSZip = (await import("jszip")).default;
    const z = new JSZip();
    z.file("publicacoes-academicas-main/package.json", '{"version":"8"}');
    z.file("publicacoes-academicas-main/src/x.ts", "novo");
    z.file("publicacoes-academicas-main/dados/publicacoes.db", "NÃO PODE");
    const destino = "/tmp/publicacoes-teste/atualizacao";
    fs.rmSync(destino, { recursive: true, force: true });
    fs.mkdirSync(destino + "/dados", { recursive: true });
    fs.writeFileSync(destino + "/dados/publicacoes.db", "meus dados");
    expect(await aplicarZip(await z.generateAsync({ type: "nodebuffer" }), destino)).toBe(2);
    expect(fs.readFileSync(destino + "/src/x.ts", "utf8")).toBe("novo");
    expect(fs.readFileSync(destino + "/dados/publicacoes.db", "utf8")).toBe("meus dados");
  });
});
