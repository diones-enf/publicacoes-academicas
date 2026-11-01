// Exportação de relatórios em CSV e XLSX (o PDF sai pela impressão do navegador).
import type { Relatorio } from "./relatorios";

export interface Cabecalho {
  nome: string;
  orcid: string | null;
  lattes: string | null;
  periodo: string;
  emissao: string;
}

function celulaCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com ponto e vírgula e BOM, para abrir certo no Excel em português. */
export function relatorioCsv(r: Relatorio, c: Cabecalho): string {
  const linhas: string[] = [];
  linhas.push(celulaCsv(r.titulo));
  linhas.push(`Pesquisador;${celulaCsv(c.nome)}`);
  linhas.push(`ORCID;${celulaCsv(c.orcid ?? "")}`);
  linhas.push(`Lattes;${celulaCsv(c.lattes ?? "")}`);
  linhas.push(`Período;${celulaCsv(c.periodo)}`);
  linhas.push(`Emitido em;${celulaCsv(c.emissao)}`);
  for (const card of r.cartoes) linhas.push(`${celulaCsv(card.rotulo)};${celulaCsv(card.valor)}`);
  for (const t of r.tabelas) {
    linhas.push("");
    linhas.push(celulaCsv(t.titulo));
    linhas.push(t.colunas.map(celulaCsv).join(";"));
    for (const l of t.linhas) linhas.push(l.map(celulaCsv).join(";"));
    if (t.totais) linhas.push(t.totais.map(celulaCsv).join(";"));
  }
  return "﻿" + linhas.join("\r\n");
}

export async function relatorioXlsx(r: Relatorio, c: Cabecalho): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const usados = new Set<string>();
  const nomeAba = (t: string) => {
    let n = t.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Aba";
    let i = 2;
    while (usados.has(n)) n = `${n.slice(0, 25)} ${i++}`;
    usados.add(n);
    return n;
  };
  const resumo = wb.addWorksheet(nomeAba("Resumo"));
  resumo.addRow([r.titulo]).font = { bold: true, size: 14 };
  resumo.addRow(["Pesquisador", c.nome]);
  resumo.addRow(["ORCID", c.orcid ?? ""]);
  resumo.addRow(["Lattes", c.lattes ?? ""]);
  resumo.addRow(["Período", c.periodo]);
  resumo.addRow(["Emitido em", c.emissao]);
  resumo.addRow([]);
  for (const card of r.cartoes) resumo.addRow([card.rotulo, card.valor]);
  resumo.getColumn(1).width = 34;
  resumo.getColumn(2).width = 50;
  for (const t of r.tabelas) {
    const ws = wb.addWorksheet(nomeAba(t.titulo));
    ws.addRow(t.colunas).font = { bold: true };
    for (const l of t.linhas) ws.addRow(l);
    if (t.totais) ws.addRow(t.totais).font = { bold: true };
    t.colunas.forEach((col, i) => {
      const coluna = ws.getColumn(i + 1);
      coluna.width = Math.min(60, Math.max(10, col.length + 2, ...t.linhas.slice(0, 50).map((l) => String(l[i] ?? "").length + 2)));
      if (t.moeda?.includes(i)) coluna.numFmt = '"R$" #,##0.00';
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
