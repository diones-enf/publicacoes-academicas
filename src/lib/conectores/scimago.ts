// SCImago (base Scopus): lista pública com SJR e quartil de todas as revistas
// indexadas no Scopus. Baixada uma vez e guardada no computador.
import fs from "node:fs";
import path from "node:path";
import { pastaDados } from "../db";
import { normalizarIssn } from "../texto";
import { cabecalhos } from "./http";
import { lerCsv } from "../planilhas";

export interface LinhaScimago {
  titulo: string;
  sjr: string | null;
  quartil: string | null;
  h: string | null;
  ano: string;
}

let cache: { ano: string; mapa: Map<string, LinhaScimago> } | null = null;
/** Motivo da última falha no download (mostrado ao usuário). */
export let ultimoErroScimago = "";

function arquivo(ano: string) {
  const p = path.join(pastaDados(), "referencias");
  fs.mkdirSync(p, { recursive: true });
  return path.join(p, `scimago-${ano}.csv`);
}

export function mapaScimago(texto: string, ano: string): Map<string, LinhaScimago> {
  const linhas = lerCsv(texto);
  const cab = (linhas.shift() ?? []).map((c) => c.toLowerCase());
  const col = (nome: string) => cab.findIndex((c) => c === nome);
  const iIssn = col("issn");
  const iTit = col("title");
  const iSjr = col("sjr");
  const iQ = col("sjr best quartile");
  const iH = col("h index");
  const mapa = new Map<string, LinhaScimago>();
  if (iIssn < 0) return mapa;
  for (const l of linhas) {
    const item: LinhaScimago = {
      titulo: l[iTit] ?? "",
      sjr: l[iSjr] ? l[iSjr].replace(",", ".") : null,
      quartil: /^Q[1-4]$/.test(l[iQ] ?? "") ? l[iQ] : null,
      h: l[iH] || null,
      ano,
    };
    for (const bruto of (l[iIssn] ?? "").split(/[,\s]+/)) {
      const issn = normalizarIssn(bruto);
      if (issn) mapa.set(issn, item);
    }
  }
  return mapa;
}

/** Carrega a lista do SCImago (baixa se não houver uma com menos de 6 meses). */
export async function carregarScimago(): Promise<Map<string, LinhaScimago> | null> {
  if (cache) return cache.mapa;
  const anoAtual = new Date().getFullYear();
  for (const ano of [String(anoAtual - 1), String(anoAtual - 2)]) {
    const a = arquivo(ano);
    const recente = fs.existsSync(a) && Date.now() - fs.statSync(a).mtimeMs < 180 * 86400000;
    if (!recente) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 90000);
        const r = await fetch(`https://www.scimagojr.com/journalrank.php?out=xls&year=${ano}`, {
          headers: {
            ...cabecalhos(),
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
            Accept: "text/csv,application/vnd.ms-excel,*/*",
          },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const texto = await r.text();
        if (r.ok && texto.toLowerCase().includes("sourceid")) fs.writeFileSync(a, texto);
        else ultimoErroScimago = `o site do SCImago respondeu ${r.status}${texto.toLowerCase().includes("<html") ? " com uma página em vez da lista" : ""}`;
      } catch (e) {
        ultimoErroScimago = (e as Error).name === "AbortError" ? "o site do SCImago demorou demais" : "sem conexão com o site do SCImago";
      }
    }
    if (fs.existsSync(a)) {
      const mapa = mapaScimago(fs.readFileSync(a, "utf8"), ano);
      if (mapa.size) {
        cache = { ano, mapa };
        return mapa;
      }
    }
  }
  return null;
}

export function limparCacheScimago() {
  cache = null;
}

/** Guarda a lista do SCImago enviada pelo usuário (CSV baixado em scimagojr.com). Devolve ano e nº de revistas. */
export function guardarScimagoEnviado(texto: string, nomeArquivo: string): { ano: string; revistas: number } {
  const t = texto.replace(/^\uFEFF/, "");
  if (!t.slice(0, 2000).toLowerCase().includes("sourceid"))
    throw new Error("Este arquivo não parece ser a lista do SCImago (falta a coluna Sourceid).");
  const ano =
    nomeArquivo.match(/(20\d{2})/)?.[1] ?? t.slice(0, 2000).match(/Total Docs\. \((20\d{2})\)/)?.[1] ?? String(new Date().getFullYear() - 1);
  const mapa = mapaScimago(t, ano);
  if (mapa.size < 100) throw new Error("A lista do SCImago veio vazia ou incompleta.");
  fs.writeFileSync(arquivo(ano), t);
  cache = { ano, mapa };
  return { ano, revistas: new Set([...mapa.values()]).size };
}
