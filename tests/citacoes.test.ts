import { afterEach, describe, expect, it, vi } from "vitest";
import { artigo, novoAmbiente, simularFetch } from "./apoio";
import { criarPublicacao } from "@/lib/publicacoes";
import { atualizarCitacoes, citacoesDaPublicacao, indiceH, indiceI10, lancarCitacoesManual, resumoCitacoes } from "@/lib/citacoes";
import { executar, todos } from "@/lib/db";
import { listarLembretes } from "@/lib/lembretes";

afterEach(() => vi.unstubAllGlobals());

// Formato da API do OpenAlex (/works?filter=doi:...)
const obra = (doi: string, id: string, total: number, porAno: [number, number][]) => ({
  id: `https://openalex.org/${id}`,
  doi: `https://doi.org/${doi}`,
  title: "x",
  publication_year: 2023,
  cited_by_count: total,
  counts_by_year: porAno.map(([year, cited_by_count]) => ({ year, cited_by_count })),
});

function rotas(totalA: number, totalB: number) {
  return {
    "filter=doi:": { results: [obra("10.1590/a.1", "W1", totalA, [[2024, 3], [2025, totalA - 3]]), obra("10.1590/b.2", "W2", totalB, [[2025, totalB]])] },
    "filter=cites:W1": { results: [
      { id: "https://openalex.org/W9", title: "Quem citou primeiro", publication_year: 2024, publication_date: "2024-02-10", doi: "https://doi.org/10.1234/c", primary_location: { source: { display_name: "Rev Citante" } } },
    ] },
    "filter=cites:W2": { results: [] },
    "api.crossref.org/works/10.1590%2Fa.1": { message: { DOI: "10.1590/a.1", "is-referenced-by-count": totalA - 1 } },
    "api.crossref.org/works/10.1590%2Fb.2": { message: { DOI: "10.1590/b.2", "is-referenced-by-count": totalB } },
  };
}

describe("índices", () => {
  it("calcula h e i10", () => {
    expect(indiceH([10, 8, 5, 4, 3])).toBe(4);
    expect(indiceH([25, 8, 5, 3, 3])).toBe(3);
    expect(indiceH([0, 0])).toBe(0);
    expect(indiceI10([10, 12, 9])).toBe(2);
  });
});

describe("14. Rotina mensal grava novo registro sem apagar os anteriores", () => {
  it("guarda a foto de cada mês, por publicação e do pesquisador", async () => {
    const ctx = await novoAmbiente();
    const a = await criarPublicacao(ctx, artigo(ctx, { titulo: "Artigo A", doi: "10.1590/a.1" }));
    const b = await criarPublicacao(ctx, artigo(ctx, { titulo: "Artigo B diferente", doi: "10.1590/b.2" }));
    simularFetch(rotas(12, 4));
    const r1 = await atualizarCitacoes(ctx.donoId);
    expect(r1).toMatchObject({ encontradas: 2, totalOpenAlex: 16, totalCrossref: 15, h: 2, novas: 0 });
    // simula que essa foto foi do mês passado
    executar("UPDATE citacao_mensal SET mes = '2026-10'");
    executar("UPDATE indicador_mensal SET mes = '2026-10'");
    vi.unstubAllGlobals();
    simularFetch(rotas(15, 4));
    const r2 = await atualizarCitacoes(ctx.donoId);
    expect(r2.novas).toBe(2); // OpenAlex e Crossref subiram no artigo A
    const historicoA = citacoesDaPublicacao(a).historico.filter((h) => h.fonte === "OpenAlex");
    expect(historicoA.map((h) => h.total)).toEqual([12, 15]);
    expect(todos("SELECT * FROM indicador_mensal WHERE fonte = 'OpenAlex'")).toHaveLength(2);
    // rodar de novo no mesmo mês não duplica
    await atualizarCitacoes(ctx.donoId);
    expect(citacoesDaPublicacao(a).historico.filter((h) => h.fonte === "OpenAlex")).toHaveLength(2);
    // aviso de citação nova
    expect(listarLembretes(ctx.donoId).filter((l) => l.tipo === "nova_citacao").map((l) => l.mensagem)[0]).toContain("3 citação(ões) nova(s)");
    // por ano, quem citou e primeira citação
    const det = citacoesDaPublicacao(a);
    expect(det.porAno).toEqual([{ ano: 2024, total: 3 }, { ano: 2025, total: 12 }]);
    expect(det.citantes[0]).toMatchObject({ titulo: "Quem citou primeiro", doi: "10.1234/c", revista: "Rev Citante" });
    expect(det.primeira).toBe("2024-02-10");
    expect(citacoesDaPublicacao(b).citantes).toHaveLength(0);
    // resumo do pesquisador
    const res = resumoCitacoes(ctx.donoId);
    expect(res.atuais.find((x) => x.fonte === "OpenAlex")).toMatchObject({ total: 19, h: 2, i10: 1 });
    expect(res.serie.filter((s) => s.fonte === "OpenAlex").map((s) => s.total)).toEqual([16, 19]);
    expect(res.maisCitadas[0].titulo).toBe("Artigo A");
  });
  it("Google Acadêmico por digitação", async () => {
    const ctx = await novoAmbiente();
    const a = await criarPublicacao(ctx, artigo(ctx));
    lancarCitacoesManual(ctx.donoId, a, 7);
    expect(resumoCitacoes(ctx.donoId).atuais.find((x) => x.fonte === "Google Acadêmico")).toMatchObject({ total: 7, h: 1 });
    expect(() => lancarCitacoesManual(ctx.donoId, a, -1)).toThrow();
  });
  it("sem internet não apaga nada e avisa", async () => {
    const ctx = await novoAmbiente();
    await criarPublicacao(ctx, artigo(ctx, { doi: "10.1590/a.1" }));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const r = await atualizarCitacoes(ctx.donoId);
    expect(r.encontradas).toBe(0);
    expect(r.avisos.join(" ")).toContain("sem conexão");
  });
});

describe("Web of Science e Scopus por digitação", () => {
  it("guardam o número e calculam h por fonte", async () => {
    const ctx = await novoAmbiente();
    const a = await criarPublicacao(ctx, artigo(ctx));
    lancarCitacoesManual(ctx.donoId, a, 3, "Web of Science");
    lancarCitacoesManual(ctx.donoId, a, 5, "Scopus");
    const r = resumoCitacoes(ctx.donoId);
    expect(r.atuais.find((x) => x.fonte === "Web of Science")).toMatchObject({ total: 3, h: 1 });
    expect(r.atuais.find((x) => x.fonte === "Scopus")).toMatchObject({ total: 5 });
    expect(r.maisCitadas[0]).toMatchObject({ wos: 3, sc: 5 });
    expect(() => lancarCitacoesManual(ctx.donoId, a, 1, "Outra")).toThrow("Fonte inválida");
  });
});
