import fs from "node:fs";
import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import { artigo, novoAmbiente } from "./apoio";
import { criarPublicacao, obterPublicacao } from "@/lib/publicacoes";
import { encontrarDatas, lerDocumento } from "@/lib/leitorDocumento";
import { aplicarDocumento } from "@/lib/aplicarDocumento";
import { textoDeArquivo, textoDeEml } from "@/lib/textoDeArquivo";
import { listarAnexos } from "@/lib/anexos";
import { todos } from "@/lib/db";

const doc = (n: string) => fs.readFileSync(`tests/documentos/${n}`, "utf8");
const val = (a: { valor: unknown } | null) => a?.valor ?? null;

describe("datas em português, inglês e espanhol", () => {
  it("entende os formatos comuns", () => {
    const t = "12/03/2026; 2026-04-01; 5 de setembro de 2026; March 7, 2026; 9 Jun 2026; 3 de fev. de 2026; 15 de agosto del 2026";
    expect(encontrarDatas(t).map((d) => d.iso)).toEqual(["2026-03-12", "2026-04-01", "2026-09-05", "2026-03-07", "2026-06-09", "2026-02-03", "2026-08-15"]);
  });
});

describe("leitura de e-mails e declarações", () => {
  it("confirmação de submissão (ScholarOne, inglês)", () => {
    const r = lerDocumento(doc("scholarone.txt"));
    expect([val(r.status), val(r.data), val(r.idSubmissao), val(r.revista)]).toEqual(["Submetido", "2026-03-12", "RLAE-2026-0412", "Revista Latino-Americana de Enfermagem"]);
    expect(val(r.titulo)).toBe("Nursing handover safety: effective communication and the SBAR tool");
    expect(r.categoria).toBe("Comprovante de submissão");
  });
  it("agradecimento de submissão (OJS, português)", () => {
    const r = lerDocumento(doc("ojs-submissao.txt"));
    expect([val(r.status), val(r.idSubmissao), val(r.revista), val(r.editor)]).toEqual(["Submetido", "8812", "Revista Ciência e Enfermagem", "Maria Aparecida Souza"]);
    expect(val(r.link)).toContain("authorDashboard/submission/8812");
  });
  it("correções obrigatórias com prazo e rodada", () => {
    const r = lerDocumento(doc("ojs-revisao.txt"));
    expect([val(r.status), val(r.data), val(r.prazo), val(r.rodada)]).toEqual(["Em revisão", "2026-03-21", "2026-04-20", 1]);
    expect(r.categoria).toBe("Pareceres dos revisores");
  });
  it("declaração de aceite (não confunde com publicação futura)", () => {
    const r = lerDocumento(doc("declaracao-aceite.txt"));
    expect([val(r.status), val(r.data), val(r.issn), val(r.revista)]).toEqual(["Aceito", "2026-09-05", "2179-8699", "Revista Veredas do Direito"]);
    expect(val(r.titulo)).toMatch(/^Saúde mental e direitos trabalhistas/);
  });
  it("recusa (Editorial Manager)", () => {
    const r = lerDocumento(doc("recusa.txt"));
    expect([val(r.status), val(r.data), val(r.idSubmissao), val(r.prazo)]).toEqual(["Recusado", "2026-06-02", "JNM-D-26-00321", null]);
  });
  it("aviso de publicação com DOI", () => {
    const r = lerDocumento(doc("publicado.txt"));
    expect([val(r.status), val(r.data), val(r.doi), val(r.revista)]).toEqual(["Publicado", "2026-08-15", "10.18623/rvd.v23.n9.7107", "Veredas do Direito"]);
  });
  it("ignora o histórico citado no fim do e-mail", () => {
    const r = lerDocumento(doc("historico.txt"));
    expect(val(r.status)).toBe("Aceito");
    expect(val(r.revista)).toBe("Revista Tópicos");
  });
  it("reconhece publicação já cadastrada pelo título e pelo número do manuscrito", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx, { titulo: "Indicadores de desempenho como ferramenta de gestão hospitalar no SUS", status: "Submetido" }));
    expect(lerDocumento(doc("ojs-revisao.txt"), ctx.donoId).publicacao).toMatchObject({ id, motivo: "título citado no documento" });
    const outra = await criarPublicacao(ctx, artigo(ctx, { titulo: "Outro artigo qualquer sobre enfermagem", status: "Submetido", id_submissao: "RLAE-2026-0412" }));
    expect(lerDocumento(doc("scholarone.txt"), ctx.donoId).publicacao).toMatchObject({ id: outra, motivo: "mesmo número de manuscrito" });
  });
});

describe("gravar o que foi lido", () => {
  it("cadastra nova submissão a partir do e-mail", async () => {
    const ctx = await novoAmbiente();
    const l = lerDocumento(doc("scholarone.txt"), ctx.donoId);
    const r = await aplicarDocumento(ctx, {
      titulo: val(l.titulo) as string, revista: val(l.revista) as string, status: "Submetido", data: val(l.data) as string,
      id_submissao: val(l.idSubmissao) as string, link_sistema: val(l.link) as string, categoria: l.categoria,
    }, { nome: "email.txt", conteudo: Buffer.from(doc("scholarone.txt")) });
    expect(r.criada).toBe(true);
    const p = obterPublicacao(ctx.donoId, r.id)!;
    expect(p).toMatchObject({ status: "Submetido", data_submissao: "2026-03-12", id_submissao: "RLAE-2026-0412" });
    expect(listarAnexos(ctx.donoId, r.id)[0].categoria).toBe("Comprovante de submissão");
  });
  it("atualiza a publicação existente: status, data, prazo e anexo", async () => {
    const ctx = await novoAmbiente();
    const id = await criarPublicacao(ctx, artigo(ctx, { titulo: "Indicadores de desempenho como ferramenta de gestão hospitalar no SUS", status: "Submetido", data_submissao: "2026-02-01" }));
    const l = lerDocumento(doc("ojs-revisao.txt"), ctx.donoId);
    const r = await aplicarDocumento(ctx, {
      publicacao_id: l.publicacao!.id, status: "Em revisão", data: val(l.data) as string, prazo_resposta: val(l.prazo) as string, rodada: 1, categoria: l.categoria,
    }, { nome: "decisao.pdf", conteudo: Buffer.from("%PDF-1.4") });
    expect(r).toMatchObject({ id, criada: false });
    const p = obterPublicacao(ctx.donoId, id)!;
    expect(p).toMatchObject({ status: "Em revisão", prazo_resposta: "2026-04-20", rodada_revisao: 1 });
    const h = todos<{ status: string; data: string }>("SELECT status, data FROM historico_status WHERE publicacao_id = ? ORDER BY id", id);
    expect(h.at(-1)).toMatchObject({ status: "Em revisão", data: "2026-03-21" });
    expect(listarAnexos(ctx.donoId, id)[0].categoria).toBe("Pareceres dos revisores");
  });
});

describe("arquivos", () => {
  it("e-mail .eml com quoted-printable e base64", () => {
    const eml = [
      "From: Revista <x@y.br>",
      "Subject: =?UTF-8?Q?Decis=C3=A3o_editorial?=",
      "Date: Mon, 6 Apr 2026 10:00:00 -0300",
      'Content-Type: multipart/alternative; boundary="b1"',
      "",
      "--b1",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Seu artigo foi aceito para publica=C3=A7=C3=A3o.",
      "--b1",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from("<p>Seu artigo foi <b>aceito</b></p>").toString("base64"),
      "--b1--",
    ].join("\r\n");
    const t = textoDeEml(Buffer.from(eml, "utf8").toString("latin1"));
    expect(t).toContain("Assunto: Decisão editorial");
    expect(t).toContain("aceito para publicação");
    const r = lerDocumento(t);
    expect([val(r.status), val(r.data)]).toEqual(["Aceito", "2026-04-06"]);
  });
  it("PDF com texto", async () => {
    const pdf = await new Promise<Buffer>((ok) => {
      const d = new PDFDocument();
      const partes: Buffer[] = [];
      d.on("data", (c: Buffer) => partes.push(c));
      d.on("end", () => ok(Buffer.concat(partes)));
      d.text("DECLARACAO. Declaramos que o artigo intitulado \"Teste de leitura de PDF no sistema\" foi submetido em 10/02/2026 a Revista Teste. Caso haja correcoes, o prazo para reenvio e ate\n20/04/2026.");
      d.end();
    });
    const t = await textoDeArquivo("declaracao.pdf", pdf);
    const r = lerDocumento(t);
    expect([val(r.status), val(r.data), val(r.titulo), val(r.prazo)]).toEqual(["Submetido", "2026-02-10", "Teste de leitura de PDF no sistema", "2026-04-20"]);
  });
  it("avisa quando não dá para ler", async () => {
    await expect(textoDeArquivo("foto.jpg", Buffer.from("x"))).rejects.toThrow(/imagem/);
    await expect(textoDeArquivo("email.msg", Buffer.from("x"))).rejects.toThrow(/Outlook/);
  });
});
