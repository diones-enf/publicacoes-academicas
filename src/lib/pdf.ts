// PDF dos relatórios (arquivo pronto para imprimir ou anexar).
import PDFDocument from "pdfkit";
import type { Celula, Relatorio, Tabela } from "./relatorios";
import type { Cabecalho } from "./exportar";

const MARGEM = 36;
const COR_TEXTO = "#1b1f24";
const COR_SUAVE = "#4d5662";
const COR_LINHA = "#d5dae1";
const COR_CABECALHO = "#eef1f5";

function texto(c: Celula, moeda: boolean): string {
  if (c === null || c === undefined || c === "") return "";
  if (typeof c === "number")
    return moeda
      ? c.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : c.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return String(c).replace(/\*\*/g, "");
}

/** Larguras proporcionais ao conteúdo, com mínimo e máximo por coluna. */
function larguras(doc: PDFKit.PDFDocument, t: Tabela, total: number): number[] {
  doc.font("Helvetica").fontSize(8);
  const medidas = t.colunas.map((c, i) => {
    const amostra = [c, ...t.linhas.slice(0, 80).map((l) => texto(l[i], !!t.moeda?.includes(i)))];
    const maior = Math.max(...amostra.map((s) => doc.widthOfString(s ?? "")));
    return Math.min(Math.max(maior + 8, 40), 260);
  });
  const soma = medidas.reduce((s, m) => s + m, 0);
  return medidas.map((m) => (m / soma) * total);
}

function desenharTabela(doc: PDFKit.PDFDocument, t: Tabela) {
  const largura = doc.page.width - MARGEM * 2;
  const ws = larguras(doc, t, largura);
  const numerica = t.colunas.map((_, i) => i > 0 && (t.moeda?.includes(i) || t.linhas.every((l) => typeof l[i] === "number" || l[i] === null || l[i] === "")));
  const fundo = () => doc.page.height - MARGEM - 20;

  const altura = (celulas: string[], negrito: boolean) => {
    doc.font(negrito ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    return Math.max(...celulas.map((s, i) => doc.heightOfString(s || " ", { width: ws[i] - 6 }))) + 6;
  };
  const linha = (celulas: string[], opcoes: { negrito?: boolean; cor?: string }) => {
    const h = altura(celulas, !!opcoes.negrito);
    if (doc.y + h > fundo()) {
      doc.addPage();
      cabecalhoTabela();
    }
    const y = doc.y;
    if (opcoes.cor) doc.rect(MARGEM, y, largura, h).fill(opcoes.cor);
    let x = MARGEM;
    doc.fillColor(COR_TEXTO).font(opcoes.negrito ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    celulas.forEach((s, i) => {
      doc.text(s, x + 3, y + 3, { width: ws[i] - 6, align: numerica[i] ? "right" : "left" });
      x += ws[i];
    });
    doc.moveTo(MARGEM, y + h).lineTo(MARGEM + largura, y + h).lineWidth(0.5).strokeColor(COR_LINHA).stroke();
    doc.x = MARGEM;
    doc.y = y + h;
  };
  const cabecalhoTabela = () => linha(t.colunas, { negrito: true, cor: COR_CABECALHO });

  if (doc.y + 60 > fundo()) doc.addPage();
  doc.fillColor(COR_TEXTO).font("Helvetica-Bold").fontSize(11).text(t.titulo, MARGEM, doc.y, { width: largura });
  doc.moveDown(0.3);
  if (!t.linhas.length) {
    doc.font("Helvetica").fontSize(9).fillColor(COR_SUAVE).text("Nada a mostrar.");
    doc.moveDown(0.8);
    return;
  }
  cabecalhoTabela();
  for (const l of t.linhas) linha(l.map((c, i) => texto(c, !!t.moeda?.includes(i))), {});
  if (t.totais) linha(t.totais.map((c, i) => texto(c, !!t.moeda?.includes(i))), { negrito: true, cor: "#f6f8fa" });
  doc.moveDown(1);
}

export function relatorioPdf(r: Relatorio, c: Cabecalho): Promise<Buffer> {
  // Tabelas largas ficam melhores na horizontal.
  const maxColunas = Math.max(0, ...r.tabelas.map((t) => t.colunas.length));
  const doc = new PDFDocument({ size: "A4", layout: maxColunas > 5 ? "landscape" : "portrait", margin: MARGEM, bufferPages: true });
  const partes: Buffer[] = [];
  doc.on("data", (b: Buffer) => partes.push(b));
  const fim = new Promise<Buffer>((ok) => doc.on("end", () => ok(Buffer.concat(partes))));
  const largura = doc.page.width - MARGEM * 2;

  doc.info.Title = r.titulo;
  doc.fillColor(COR_TEXTO).font("Helvetica-Bold").fontSize(16).text(r.titulo, { width: largura });
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(9).fillColor(COR_SUAVE);
  doc.text(`Pesquisador(a): ${c.nome}`);
  doc.text(`ORCID: ${c.orcid ?? "—"}    Lattes: ${c.lattes ?? "—"}`);
  doc.text(`Período: ${c.periodo}    Emitido em: ${c.emissao}`);
  if (r.descricao) {
    doc.moveDown(0.3);
    doc.text(r.descricao, { width: largura });
  }
  doc.moveDown(0.8);

  if (r.cartoes.length) {
    const porLinha = Math.min(4, r.cartoes.length);
    const w = largura / porLinha;
    for (let i = 0; i < r.cartoes.length; i += porLinha) {
      const y = doc.y;
      r.cartoes.slice(i, i + porLinha).forEach((card, k) => {
        const x = MARGEM + k * w;
        doc.roundedRect(x + 2, y, w - 4, 42, 4).lineWidth(0.5).strokeColor(COR_LINHA).stroke();
        doc.fillColor(COR_SUAVE).font("Helvetica").fontSize(8).text(card.rotulo, x + 8, y + 6, { width: w - 16 });
        doc.fillColor(COR_TEXTO).font("Helvetica-Bold").fontSize(12).text(card.valor, x + 8, y + 20, { width: w - 16 });
      });
      doc.x = MARGEM;
      doc.y = y + 50;
    }
    doc.moveDown(0.5);
  }

  if (r.referencias) {
    doc.fillColor(COR_TEXTO).font("Helvetica").fontSize(10);
    if (!r.referencias.length) doc.text("Nenhuma publicação com estes filtros.");
    for (const ref of r.referencias) {
      // **negrito** da ABNT
      const partesRef = ref.split(/\*\*(.+?)\*\*/g);
      partesRef.forEach((p, i) =>
        doc.font(i % 2 ? "Helvetica-Bold" : "Helvetica").text(p, { width: largura, continued: i < partesRef.length - 1, align: "justify" }),
      );
      doc.moveDown(0.6);
    }
  } else {
    for (const t of r.tabelas) desenharTabela(doc, t);
  }

  // Rodapé com número de página
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // escrever no rodapé sem abrir página nova
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COR_SUAVE)
      .text(`${r.titulo} — página ${i + 1} de ${paginas.count}`, MARGEM, doc.page.height - MARGEM + 8, { width: largura, align: "right", lineBreak: false });
  }
  doc.end();
  return fim;
}
