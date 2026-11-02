// Importação das listas oficiais (Qualis da CAPES e JCR da Clarivate) a partir
// de planilhas baixadas pelo usuário. Os nomes das colunas são reconhecidos
// automaticamente, sem precisar arrumar o arquivo.
import { executar, inserir, transacao, todos } from "./db";
import { chaveRevista, normalizar, normalizarIssn } from "./texto";

/** Lê CSV com ; ou , e campos entre aspas. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  // Separador: o que aparece mais nas primeiras linhas (fora de aspas)
  const amostra = t.slice(0, 5000).replace(/"[^"]*"/g, "");
  const sep = (amostra.match(/;/g)?.length ?? 0) >= (amostra.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo.trim());
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo.trim());
      if (linha.some((x) => x !== "")) linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  linha.push(campo.trim());
  if (linha.some((x) => x !== "")) linhas.push(linha);
  return linhas;
}

export async function lerPlanilha(conteudo: Buffer, nome: string): Promise<string[][]> {
  const n = nome.toLowerCase();
  if (n.endsWith(".xls"))
    throw new Error('Arquivo .xls antigo. Abra no Excel e use "Salvar como" → "Pasta de Trabalho do Excel (.xlsx)", ou salve como CSV.');
  if (n.endsWith(".xlsx")) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(conteudo as unknown as ArrayBuffer);
    const out: string[][] = [];
    for (const ws of wb.worksheets) {
      ws.eachRow((r) => {
        const valores = (r.values as unknown[]).slice(1).map((v) => {
          if (v === null || v === undefined) return "";
          if (typeof v === "object" && v && "text" in v) return String((v as { text: unknown }).text);
          if (typeof v === "object" && v && "result" in v) return String((v as { result: unknown }).result ?? "");
          return String(v);
        });
        if (valores.some((x) => x.trim())) out.push(valores.map((x) => x.trim()));
      });
    }
    return out;
  }
  // CSV: tenta UTF-8; se vier com caracteres estranhos, usa Latin-1 (comum em arquivos da CAPES)
  let texto = conteudo.toString("utf8");
  if (texto.includes("�")) texto = conteudo.toString("latin1");
  return lerCsv(texto);
}

/** Acha a linha de cabeçalho (a primeira que tem uma coluna de ISSN) e devolve índice de cada coluna pedida. */
function acharColunas(linhas: string[][], regras: Record<string, (c: string) => boolean>) {
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    const cab = linhas[i].map((c) => normalizar(c));
    if (!cab.some((c) => c === "issn" || c.startsWith("issn"))) continue;
    const idx: Record<string, number> = {};
    for (const [nome, regra] of Object.entries(regras)) idx[nome] = cab.findIndex(regra);
    return { inicio: i + 1, idx, cab: linhas[i] };
  }
  return null;
}

export interface ResultadoImportacao {
  linhas: number;
  revistasAtualizadas: number;
}

/** Planilha do Qualis (Sucupira ou dados abertos da CAPES): ISSN, título, área de avaliação, estrato. */
/** "classificacoes_publicadas_enfermagem_2026_123.xlsx" -> "Enfermagem" (o Sucupira põe a área no nome do arquivo). */
export function areaDoNomeArquivo(nome: string): string {
  const m = nome.toLowerCase().match(/classificacoes_publicadas_(.+?)_\d{4}/);
  return m ? tituloArea(m[1].replace(/_/g, " ").toUpperCase()) : "";
}

export function importarQualis(linhas: string[][], periodo: string, nomeArquivo: string, areaInformada = ""): number {
  const c = acharColunas(linhas, {
    issn: (x) => x === "issn" || x.startsWith("issn"),
    titulo: (x) => x.startsWith("titulo") || x.includes("periodico"),
    area: (x) => x.includes("area"),
    estrato: (x) => x.includes("estrato") || x === "qualis" || x.includes("classificacao"),
  });
  if (!c || c.idx.estrato < 0)
    throw new Error("Não encontrei as colunas ISSN e Estrato nesta planilha. Confira se é a lista do Qualis.");
  // A exportação do Sucupira por área não traz a coluna de área: usa a informada ou a do nome do arquivo.
  const areaFixa = areaInformada.trim() || areaDoNomeArquivo(nomeArquivo);
  if (c.idx.area < 0 && !areaFixa) throw new Error("Esta planilha não tem a coluna de área. Informe a área de avaliação no campo acima.");
  const p = periodo.trim();
  if (!/^\d{4}-\d{4}$/.test(p)) throw new Error("Informe o quadriênio no formato 2021-2024.");
  let n = 0;
  transacao(() => {
    for (const l of linhas.slice(c.inicio)) {
      const issn = normalizarIssn(l[c.idx.issn]);
      const estrato = (l[c.idx.estrato] ?? "").toUpperCase().trim();
      const area = (c.idx.area >= 0 ? (l[c.idx.area] ?? "").trim() : "") || areaFixa;
      if (!issn || !/^(A[1-4]|B[1-4]|C|NP)$/.test(estrato) || !area) continue;
      executar("DELETE FROM ref_qualis WHERE issn = ? AND area = ? AND periodo = ?", issn, tituloArea(area), p);
      const titulo = c.idx.titulo >= 0 ? l[c.idx.titulo] : null;
      inserir("ref_qualis", { issn, titulo, titulo_normalizado: titulo ? chaveRevista(titulo) : null, area: tituloArea(area), estrato, periodo: p });
      n++;
    }
    inserir("importacao_lista", { tipo: "Qualis", arquivo: nomeArquivo, periodo: p, linhas: n });
  });
  if (!n) throw new Error("Nenhuma linha válida encontrada (ISSN + área + estrato A1 a C).");
  return n;
}

/** "ENFERMAGEM" -> "Enfermagem"; "SAÚDE COLETIVA" -> "Saúde Coletiva". */
function tituloArea(a: string): string {
  if (a !== a.toUpperCase()) return a;
  const minus = new Set(["de", "da", "do", "das", "dos", "e"]);
  return a
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && minus.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/\b(Iii|Ii|Iv|Vi|Vii|Viii)\b/g, (m) => m.toUpperCase());
}

/** Exportação do JCR (Clarivate): ISSN, eISSN, JIF, JIF 5 anos, JCI, quartil, categoria, edição. */
export function importarJcr(linhas: string[][], nomeArquivo: string): { linhas: number; ano: string } {
  const c = acharColunas(linhas, {
    issn: (x) => x === "issn",
    eissn: (x) => x === "eissn" || x === "e issn",
    titulo: (x) => x.includes("journal name") || x === "full journal title" || x === "journal title" || x === "title",
    jif: (x) => /(^|\s)jif$/.test(x) || /^\d{4} jif$/.test(x) || x === "journal impact factor",
    jif5: (x) => x.includes("5 year") || x.includes("five year"),
    jci: (x) => /jci$/.test(x),
    quartil: (x) => x.includes("quartile"),
    categoria: (x) => x.includes("category"),
    edicao: (x) => x.includes("edition"),
  });
  if (!c || c.idx.jif < 0) throw new Error("Não encontrei as colunas ISSN e JIF. Confira se é a exportação do JCR.");
  const ano = c.cab[c.idx.jif].match(/\d{4}/)?.[0] ?? String(new Date().getFullYear() - 1);
  let n = 0;
  transacao(() => {
    for (const l of linhas.slice(c.inicio)) {
      const jif = (l[c.idx.jif] ?? "").replace(",", ".").trim();
      const base = {
        titulo: c.idx.titulo >= 0 ? l[c.idx.titulo] : null,
        ano,
        jif: /^[\d.]+$/.test(jif) ? jif : null,
        jif5: c.idx.jif5 >= 0 ? (l[c.idx.jif5] ?? "").replace(",", ".") || null : null,
        jci: c.idx.jci >= 0 ? (l[c.idx.jci] ?? "").replace(",", ".") || null : null,
        quartil: c.idx.quartil >= 0 && /^Q[1-4]$/.test(l[c.idx.quartil] ?? "") ? l[c.idx.quartil] : null,
        categoria: c.idx.categoria >= 0 ? l[c.idx.categoria] || null : null,
        edicao: c.idx.edicao >= 0 ? l[c.idx.edicao] || null : null,
      };
      for (const coluna of [c.idx.issn, c.idx.eissn]) {
        const issn = coluna >= 0 ? normalizarIssn(l[coluna]) : null;
        if (issn) {
          executar("DELETE FROM ref_jcr WHERE issn = ? AND ano = ?", issn, ano);
          inserir("ref_jcr", { issn, ...base });
          n++;
        }
      }
    }
    inserir("importacao_lista", { tipo: "JCR", arquivo: nomeArquivo, periodo: ano, linhas: n });
  });
  if (!n) throw new Error("Nenhuma linha com ISSN encontrada.");
  return { linhas: n, ano };
}

export function listasImportadas() {
  return todos<{ tipo: string; arquivo: string | null; periodo: string | null; linhas: number; em: string }>(
    "SELECT tipo, arquivo, periodo, linhas, em FROM importacao_lista ORDER BY id DESC LIMIT 20",
  );
}

/**
 * Texto copiado da tela de resultados do Sucupira (Ctrl+A, Ctrl+C na página).
 * Cada linha com um ISSN e um estrato vira uma classificação. A área vem da
 * própria linha (coluna "Área de Avaliação") ou, se não houver, da área informada.
 */
export function importarQualisColado(texto: string, periodo: string, areaPadrao: string): number {
  const p = periodo.trim();
  if (!/^\d{4}-\d{4}$/.test(p)) throw new Error("Informe o quadriênio no formato 2021-2024.");
  const linhas: string[][] = [["ISSN", "Título", "Área de Avaliação", "Estrato"]];
  for (const bruta of texto.split(/\r?\n/)) {
    const issnM = bruta.match(/\b(\d{4}-?\d{3}[\dXx])\b/);
    const estratos = [...bruta.matchAll(/(?:^|[\s\t|;])(A[1-4]|B[1-4]|C)(?=$|[\s\t|;])/g)];
    if (!issnM || !estratos.length) continue;
    const estrato = estratos[estratos.length - 1][1];
    const partes = bruta.split("\t").map((x) => x.trim()).filter(Boolean);
    let area = areaPadrao.trim();
    let titulo = "";
    if (partes.length >= 4) {
      titulo = partes[1];
      area = partes[2] || area;
    } else if (partes.length === 3) titulo = partes[1];
    linhas.push([issnM[1], titulo, area, estrato]);
  }
  if (linhas.length === 1)
    throw new Error("Não encontrei linhas com ISSN e estrato no texto colado. Copie a página de resultados do Sucupira (Ctrl+A, Ctrl+C).");
  if (linhas.slice(1).some((l) => !l[2])) throw new Error("Informe a área de avaliação (ex.: Enfermagem).");
  return importarQualis(linhas, p, "colado do Sucupira");
}
