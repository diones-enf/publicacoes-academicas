import { describe, expect, it } from "vitest";
import { apcDoMiguilim, baseDoMiguilim, importarMiguilim } from "@/lib/miguilim";
import { novoAmbiente } from "./apoio";
import { encontrarOuCriarVeiculo, indexacoesDoVeiculo, metricasDoVeiculo, salvarIndexacao } from "@/lib/veiculos";
import { aplicarListasEmTodas } from "@/lib/metricasAuto";

const CSV = [
  '"id","dc.identifier.issn[pt_BR]","dc.identifier.issnl[pt_BR]","dc.title[pt_BR]","dc.relation.informationservices[pt_BR]","dc.identifier.h5index[pt_BR]","dc.description.apc[pt_BR]","dc.description.publicationfees[pt_BR]"',
  '"1","2675-049X||1415-8264","1415-8264","Nursing (Santana de Parnaíba. Online)","Qualis Periódicos (2017-2020)||OpenAlex||BVS (Biblioteca Virtual en Salud)||CINHAL Full Text||CUIDEN||Latindex-Directorio||Scopus","9","1.200 BRL","A revista cobra taxa de processamento de artigos (APC)"',
  '"2","2965-6672","","Revista Tópicos","BASE (Bielefeld Academic Search Engine)||Diadorim (Diretório de políticas editoriais das revistas científicas brasileiras)||Google Scholar","","0 BRL","A revista não cobra qualquer taxa de publicação"',
].join("\n");

describe("Miguilim (IBICT)", () => {
  it("mapeia nomes de bases e APC", () => {
    expect(baseDoMiguilim("CINHAL Full Text")).toBe("CINAHL");
    expect(baseDoMiguilim("LILACS (Literatura Latino-Americana e do Caribe em Ciências da Saúde)")).toBe("LILACS");
    expect(baseDoMiguilim("Web of Science - Emerging Sources Citation Index (ESCI)")).toBe("WoS ESCI");
    expect(baseDoMiguilim("Latindex-Catálogo 2.0")).toBe("Latindex");
    expect(baseDoMiguilim("Google Scholar")).toBeNull();
    expect(baseDoMiguilim("Qualis Periódicos (2017-2020)")).toBeNull();
    expect(apcDoMiguilim("1.200 BRL")).toEqual({ valor: 1200, moeda: "BRL" });
    expect(apcDoMiguilim("Não possui")).toEqual({ valor: 0, moeda: "BRL" });
  });
  it("marca as indexações declaradas sem rebaixar o que é oficial", async () => {
    const ctx = await novoAmbiente();
    const nursing = encontrarOuCriarVeiculo(ctx.donoId, { nome: "Nursing", issn: "1415-8264" });
    const topicos = encontrarOuCriarVeiculo(ctx.donoId, { nome: "Revista Tópicos", eissn: "2965-6672" });
    salvarIndexacao(ctx.donoId, nursing, { base: "Scopus", selo: "confirmado_oficial", fonte: "SCImago" });
    expect(importarMiguilim(CSV, "search-results.csv")).toMatchObject({ revistas: 2 });
    aplicarListasEmTodas(ctx.donoId);
    const ixN = Object.fromEntries(indexacoesDoVeiculo(nursing).map((i) => [i.base, i.selo]));
    expect(ixN).toEqual({
      BVS: "informado_revista", CINAHL: "informado_revista", CUIDEN: "informado_revista", Latindex: "informado_revista",
      Miguilim: "confirmado_oficial", Scopus: "confirmado_oficial",
    });
    expect(indexacoesDoVeiculo(nursing).find((i) => i.base === "Scopus")!.fonte).toBe("SCImago");
    expect(metricasDoVeiculo(nursing).map((m) => [m.indicador, m.valor])).toEqual(expect.arrayContaining([["H5", "9"], ["APC_BRL", "1200"]]));
    expect(indexacoesDoVeiculo(topicos).map((i) => i.base).sort()).toEqual(["BASE", "Diadorim", "Miguilim"]);
  });
});
