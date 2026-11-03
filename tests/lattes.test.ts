import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { artigo, novoAmbiente } from "./apoio";
import { lerCurriculo, textoDoArquivoLattes } from "@/lib/lattes";
import { desfazerImportacao, importarLattes, previaLattes } from "@/lib/importacaoLattes";
import { criarPublicacao, obterPublicacao } from "@/lib/publicacoes";
import { listarPublicacoes } from "@/lib/filtros";
import { buscarUsuario, nomesCitacaoDe } from "@/lib/auth";

const XML = fs.readFileSync(__dirname + "/dados/curriculo-exemplo.xml");

async function zipado(): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const z = new JSZip();
  z.file("curriculo.xml", XML);
  return z.generateAsync({ type: "nodebuffer" });
}

describe("leitura do currículo Lattes", () => {
  it("lê o .zip em ISO-8859-1 com acentos e todos os tipos", async () => {
    const cv = lerCurriculo(await textoDoArquivoLattes(await zipado(), "curriculo.zip"));
    expect(cv.idLattes).toBe("0974155340588469");
    expect(cv.nomesCitacao).toContain("ROSA, DANIELA");
    expect(cv.itens.map((i) => i.origem)).toEqual([
      "Artigo publicado", "Artigo publicado", "Artigo aceito para publicação", "Trabalho em evento",
      "Livro organizado", "Capítulo de livro", "Texto em jornal ou revista", "Apresentação de trabalho",
    ]);
    const a = cv.itens[0];
    expect(a).toMatchObject({ titulo: "Indicadores de desempenho como ferramenta de gestão hospitalar no SUS", veiculo: "Revista Tópicos", issn: "2965-6672", volume: "4", numero: "27", paginas: "1-15", doi: "10.70773/revistatopicos/781233754", link: "http://revistatopicos.com.br/x", palavras_chave: "Gestão; SUS" });
    expect(cv.itens[1].titulo).toBe("Saúde mental & direitos trabalhistas");
    expect(cv.itens[3]).toMatchObject({ subtipo: "Resumo expandido", evento: { nome: "IV Congresso Nacional de Saúde", cidade: "Recife" } });
    expect(cv.itens[3].autores.map((x) => x.citacao)).toEqual(["ROSA, D. R.", "SCHIAVÃO, L."]);
    expect(cv.itens[6].data_publicacao).toBe("2026-03-12");
  });
});

describe("1. Importar duas vezes o mesmo Lattes não cria nada novo", () => {
  it("prévia, importação, segunda importação, completar e desfazer", async () => {
    const ctx = await novoAmbiente();
    // já cadastrado à mão (com o mesmo DOI): só deve ser completado, sem apagar o que foi digitado
    const manual = await criarPublicacao(ctx, artigo(ctx, { titulo: "Meu título digitado", doi: "10.70773/revistatopicos/781233754", observacoes: "minha nota", veiculo: null, volume: null }));
    const cv = lerCurriculo(await textoDoArquivoLattes(XML, "curriculo.xml"));
    const previa = previaLattes(ctx.donoId, cv);
    expect(previa.map((p) => p.situacao)).toEqual(["existente", "novo", "novo", "novo", "novo", "novo", "novo", "novo"]);
    const r1 = await importarLattes(ctx, cv, {}, "curriculo.xml");
    expect(r1).toMatchObject({ criados: 7, completados: 1, erros: [] });
    const m = obterPublicacao(ctx.donoId, manual)!;
    expect(m.titulo).toBe("Meu título digitado");
    expect(m.observacoes).toBe("minha nota");
    expect(m.volume).toBe("4");
    expect(m.veiculo_nome).toBe("Revista Tópicos");
    // autor principal pelo ID do Lattes, papel e status
    const lista = listarPublicacoes(ctx.donoId, { secao: "" }, null);
    const art = lista.find((p) => p.titulo.startsWith("Saúde mental"))!;
    expect(art).toMatchObject({ status: "Publicado", veiculo: "Veredas do Direito", papel_autor: "Autor principal", taxa_publicacao_nao_sei: 1 });
    expect(lista.find((p) => p.titulo === "Artigo aceito no prelo")!.status).toBe("Aceito");
    expect(lista.find((p) => p.titulo === "Sepse na emergência: relato")).toMatchObject({ tipo_chave: "anais", subtipo: "Resumo expandido", evento: "IV Congresso Nacional de Saúde" });
    // segunda importação do mesmo arquivo
    const previa2 = previaLattes(ctx.donoId, cv);
    expect(previa2.every((p) => p.situacao === "existente")).toBe(true);
    const r2 = await importarLattes(ctx, cv, {}, "curriculo.xml");
    expect(r2.criados).toBe(0);
    expect(listarPublicacoes(ctx.donoId, { secao: "" }, null)).toHaveLength(8);
    // nomes em citação do Lattes acrescentados ao cadastro
    expect(nomesCitacaoDe(buscarUsuario(ctx.donoId)!)).toContain("ROSA, DANIELA");
    // desfazer a primeira importação
    desfazerImportacao(ctx, r1.importacaoId);
    const resto = listarPublicacoes(ctx.donoId, { secao: "" }, null);
    expect(resto.map((p) => p.titulo)).toEqual(["Meu título digitado"]);
    expect(obterPublicacao(ctx.donoId, manual)!.volume).toBeNull();
    expect(obterPublicacao(ctx.donoId, manual)!.observacoes).toBe("minha nota");
    expect(() => desfazerImportacao(ctx, r1.importacaoId)).toThrow("já foi desfeita");
  });
});
