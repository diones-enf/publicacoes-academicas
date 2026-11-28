import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { artigo, novoAmbiente } from "./apoio";
import { criarPublicacao, excluirPublicacao } from "@/lib/publicacoes";
import { contarAnexos, excluirAnexo, limparAnexosOrfaos, listarAnexos, obterAnexo, salvarAnexo, alterarAnexo } from "@/lib/anexos";
import { cadastrarAutor } from "@/lib/auth";

const pdf = Buffer.from("%PDF-1.4 teste");

describe("Anexos", () => {
  it("guarda, lista, troca o tipo e exclui o arquivo", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx, { status: "Em revisão" }));
    const a = salvarAnexo(ctx.donoId, id, { nome: "C:\\Users\\x\\Pareceres rodada 1 ção.pdf", conteudo: pdf, tipo: "application/pdf" }, "Pareceres dos revisores", " revisor 1 ");
    const l = listarAnexos(ctx.donoId, id);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ categoria: "Pareceres dos revisores", nome_original: "Pareceres rodada 1 ção.pdf", tamanho: pdf.length, status_na_hora: "Em revisão", observacao: "revisor 1" });
    const arq = obterAnexo(ctx.donoId, a)!;
    expect(fs.readFileSync(arq.caminho).toString()).toBe("%PDF-1.4 teste");
    expect(contarAnexos(ctx.donoId).get(id)).toBe(1);
    alterarAnexo(ctx.donoId, a, { categoria: "Carta de aceite" });
    expect(listarAnexos(ctx.donoId, id)[0].categoria).toBe("Carta de aceite");
    salvarAnexo(ctx.donoId, id, { nome: "x.docx", conteudo: pdf }, "categoria inventada");
    expect(listarAnexos(ctx.donoId, id)[0].categoria).toBe("Outro");
    excluirAnexo(ctx.donoId, a);
    expect(fs.existsSync(arq.caminho)).toBe(false);
    expect(listarAnexos(ctx.donoId, id)).toHaveLength(1);
  });

  it("recusa arquivo vazio e publicação de outro autor", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx));
    expect(() => salvarAnexo(ctx.donoId, id, { nome: "v.pdf", conteudo: Buffer.alloc(0) }, "Outro")).toThrow(/vazio/);
    const outro = await cadastrarAutor({ cpf: "111.444.777-35", senha: "123987", nome: "Outra Pessoa", nomesCitacao: [], dataNascimento: "1990-01-01", consentimento: true });
    expect(() => salvarAnexo(outro.id, id, { nome: "a.pdf", conteudo: pdf }, "Outro")).toThrow(/não encontrada/);
    const a = salvarAnexo(ctx.donoId, id, { nome: "a.pdf", conteudo: pdf }, "Outro");
    expect(obterAnexo(outro.id, a)).toBeNull();
    expect(listarAnexos(outro.id, id)).toHaveLength(0);
  });

  it("apaga os arquivos de publicação excluída na limpeza diária", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx));
    const a = salvarAnexo(ctx.donoId, id, { nome: "a.pdf", conteudo: pdf }, "Outro");
    const caminho = obterAnexo(ctx.donoId, a)!.caminho;
    excluirPublicacao(ctx, id);
    expect(fs.existsSync(caminho)).toBe(true);
    expect(limparAnexosOrfaos()).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(caminho)).toBe(false);
  });
});
