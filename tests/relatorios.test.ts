import { describe, expect, it } from "vitest";
import { artigo, novoAmbiente } from "./apoio";
import { criarPublicacao } from "@/lib/publicacoes";
import { gerarRelatorio, RELATORIOS } from "@/lib/relatorios";
import { relatorioPdf } from "@/lib/pdf";
import { carregarDadosExemplo } from "@/lib/exemplo";
import { resumoRevistasPorQualis, salvarMetrica, encontrarOuCriarVeiculo } from "@/lib/veiculos";

const cab = { nome: "Diones da Rocha Rosa", orcid: "0009-0003-6024-5069", lattes: "http://lattes.cnpq.br/0974155340588469", periodo: "Todo o período", emissao: "03/11/2026 10:00" };

describe("relatórios: totais e PDF", () => {
  it("todas as tabelas têm linha de total e todos os relatórios geram PDF", async () => {
    const ctx = await novoAmbiente();
    await carregarDadosExemplo(ctx);
    for (const { chave } of RELATORIOS) {
      const r = gerarRelatorio(chave, ctx.donoId, {}, {}, "Enfermagem")!;
      for (const t of r.tabelas) if (t.linhas.length) expect(t.totais, `${chave} / ${t.titulo}`).toBeTruthy();
      const pdf = await relatorioPdf(r, cab);
      expect(pdf.subarray(0, 5).toString(), chave).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(1500);
    }
    const sub = gerarRelatorio("submissoes", ctx.donoId, {}, {}, null)!.tabelas.find((t) => t.titulo === "Por status")!;
    expect(sub.totais![0]).toBe("Total");
    expect(sub.totais![1]).toBe(sub.linhas.reduce((s, l) => s + Number(l[1]), 0));
    const artigos = gerarRelatorio("artigos", ctx.donoId, {}, {}, null)!.tabelas[0];
    expect(String(artigos.totais![0])).toMatch(/^Total: \d+ ite/);
  });
  it("resumo de revistas por área e estrato", async () => {
    const ctx = await novoAmbiente();
    const r1 = encontrarOuCriarVeiculo(ctx.donoId, { nome: "Rev 1", issn: "0102-6933" });
    const r2 = encontrarOuCriarVeiculo(ctx.donoId, { nome: "Rev 2", issn: "1806-3845" });
    encontrarOuCriarVeiculo(ctx.donoId, { nome: "Rev 3 sem Qualis", issn: "2965-6672" });
    salvarMetrica(ctx.donoId, r1, { indicador: "QUALIS", valor: "A2", area: "Direito", periodo: "2021-2024" });
    salvarMetrica(ctx.donoId, r1, { indicador: "QUALIS", valor: "A2", area: "Enfermagem", periodo: "2021-2024" });
    salvarMetrica(ctx.donoId, r1, { indicador: "QUALIS", valor: "B1", area: "Enfermagem", periodo: "2017-2020" }); // antigo: ignorado
    salvarMetrica(ctx.donoId, r2, { indicador: "QUALIS", valor: "A2", area: "Direito", periodo: "2021-2024" });
    await criarPublicacao(ctx, artigo(ctx, { titulo: "P1", veiculo_id: r1, veiculo: null }));
    await criarPublicacao(ctx, artigo(ctx, { titulo: "P2 outro", veiculo_id: r2, veiculo: null }));
    await criarPublicacao(ctx, artigo(ctx, { titulo: "P3 mais um", veiculo_id: r2, veiculo: null }));
    const r = resumoRevistasPorQualis(ctx.donoId);
    expect(r.porArea.map((l) => [l.area, l.estrato, l.revistas, l.publicacoes])).toEqual([
      ["Direito", "A2", 2, 3],
      ["Enfermagem", "A2", 1, 1],
    ]);
    expect(r.porEstrato).toEqual([{ estrato: "A2", revistas: 2, publicacoes: 3 }]);
    // com Qualis diferentes por área, cada revista conta uma vez, pela área de referência
    salvarMetrica(ctx.donoId, r2, { indicador: "QUALIS", valor: "B2", area: "Enfermagem", periodo: "2021-2024" });
    const ref = resumoRevistasPorQualis(ctx.donoId, "Enfermagem");
    expect(ref.porEstrato).toEqual([{ estrato: "A2", revistas: 1, publicacoes: 1 }, { estrato: "B2", revistas: 1, publicacoes: 2 }]);
    const melhor = resumoRevistasPorQualis(ctx.donoId, null);
    expect(melhor.porEstrato.reduce((s, e) => s + e.revistas, 0)).toBe(2);
    expect(r.totais).toMatchObject({ revistas: 3, publicacoes: 3, sem_qualis: 1 });
  });
});
