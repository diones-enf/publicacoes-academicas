// Miguilim (IBICT): diretório das revistas científicas brasileiras. O arquivo
// exportado ("search-results.csv") traz, para cada revista, as bases em que ela
// declara estar indexada, o índice h5 e a taxa de publicação (APC).
import { executar, inserir, transacao } from "./db";
import { lerCsv } from "./planilhas";
import { normalizarIssn } from "./texto";

/** Nome da base no Miguilim -> nome usado no sistema. Nomes fora desta lista são ignorados. */
const MAPA: [RegExp, string][] = [
  [/lilacs/i, "LILACS"],
  [/bdenf/i, "BDENF"],
  [/^bvs\b|biblioteca virtual en salud|biblioteca virtual em sa[uú]de/i, "BVS"],
  [/cuiden/i, "CUIDEN"],
  [/cin[h]?a[h]?l/i, "CINAHL"],
  [/latindex/i, "Latindex"],
  [/redalyc/i, "Redalyc"],
  [/scielo/i, "SciELO"],
  [/^scopus$/i, "Scopus"],
  [/^doaj|directory of open access journals/i, "DOAJ"],
  [/emerging sources|\(esci\)|^esci\b/i, "WoS ESCI"],
  [/science citation index expanded|\(scie\)/i, "WoS SCIE"],
  [/social sciences citation index|\(ssci\)/i, "WoS SSCI"],
  [/arts and humanities citation|\(ahci\)/i, "WoS AHCI"],
  [/^medline$|^pubmed$|^pubmed central$/i, "PubMed/MEDLINE"],
  [/embase/i, "Embase"],
  [/psycinfo/i, "PsycINFO"],
  [/erih/i, "ERIH PLUS"],
  [/sum[aá]rios\.org/i, "Sumários.org"],
  [/dialnet/i, "Dialnet"],
  [/^redib/i, "REDIB"],
  [/vlex/i, "vLex"],
  [/ibecs/i, "IBECS"],
  [/diadorim/i, "Diadorim"],
  [/oasisbr/i, "Oasisbr"],
  [/^road\b/i, "ROAD"],
  [/^clase\b/i, "CLASE"],
  [/biblat/i, "BIBLAT"],
  [/^peri[oó]dica\b/i, "Periódica"],
  [/latinrev/i, "LatinREV"],
  [/cab abstracts/i, "CAB Abstracts"],
  [/index copernicus/i, "Index Copernicus"],
  [/^base \(bielefeld/i, "BASE"],
  [/^ebsco$|academic search (premier|complete)/i, "EBSCO"],
  [/portal de peri[oó]dicos capes/i, "Portal de Periódicos CAPES"],
  [/miguilim/i, "Miguilim"],
];

export function baseDoMiguilim(nome: string): string | null {
  const n = nome.trim();
  for (const [re, base] of MAPA) if (re.test(n)) return base;
  return null;
}

/** "300 BRL", "0 BRL.", "US$ 1.200", "Não possui" -> valor e moeda. */
export function apcDoMiguilim(texto: string): { valor: number; moeda: string } | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  if (/n[aã]o (possui|cobra)/i.test(t)) return { valor: 0, moeda: "BRL" };
  const m = t.replace(/\./g, "").replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const moeda = /usd|us\$|d[oó]lar/i.test(t) ? "USD" : /eur|€/i.test(t) ? "EUR" : "BRL";
  return { valor: Number(m[1]), moeda };
}

export interface ResultadoMiguilim {
  revistas: number;
  indexacoes: number;
}

export function importarMiguilim(texto: string, nomeArquivo: string): ResultadoMiguilim {
  const linhas = lerCsv(texto);
  const cab = linhas.shift() ?? [];
  const col = (nome: string) => cab.findIndex((c) => c.startsWith(nome));
  const iServ = col("dc.relation.informationservices");
  const iIssn = col("dc.identifier.issn[");
  const iIssnl = col("dc.identifier.issnl");
  const iTitulo = col("dc.title[");
  const iH5 = col("dc.identifier.h5index");
  const iApc = col("dc.description.apc");
  const iTaxas = col("dc.description.publicationfees");
  if (iServ < 0 || iIssn < 0) throw new Error("Este arquivo não parece ser a exportação do Miguilim (faltam as colunas de ISSN e de serviços de informação).");
  let revistas = 0;
  let indexacoes = 0;
  transacao(() => {
    executar("DELETE FROM ref_indexacao WHERE fonte = 'Miguilim'");
    executar("DELETE FROM ref_miguilim");
    for (const l of linhas) {
      const issns = [...new Set(
        [l[iIssn], iIssnl >= 0 ? l[iIssnl] : ""].flatMap((v) => String(v ?? "").split(/\|\||[;,\s]+/)).map((x) => normalizarIssn(x)).filter(Boolean) as string[],
      )];
      if (!issns.length) continue;
      revistas++;
      const bases = new Set(String(l[iServ] ?? "").split("||").map(baseDoMiguilim).filter(Boolean) as string[]);
      bases.add("Miguilim");
      const apc = iApc >= 0 ? apcDoMiguilim(l[iApc]) : null;
      const h5 = iH5 >= 0 && /^\d+$/.test(String(l[iH5] ?? "").trim()) ? Number(l[iH5]) : null;
      for (const issn of issns) {
        for (const base of bases) {
          // lista oficial já importada (ex.: CINAHL) tem prioridade: não é sobrescrita
          executar(
            "INSERT OR IGNORE INTO ref_indexacao (base, issn, titulo, interrompida, selo, fonte) VALUES (?, ?, ?, 0, ?, 'Miguilim')",
            base,
            issn,
            iTitulo >= 0 ? l[iTitulo] || null : null,
            base === "Miguilim" ? "confirmado_oficial" : "informado_revista",
          );
          indexacoes++;
        }
        executar(
          "INSERT OR REPLACE INTO ref_miguilim (issn, titulo, h5, apc_valor, apc_moeda, taxas) VALUES (?, ?, ?, ?, ?, ?)",
          issn,
          iTitulo >= 0 ? l[iTitulo] || null : null,
          h5,
          apc?.valor ?? null,
          apc?.moeda ?? null,
          iTaxas >= 0 ? l[iTaxas] || null : null,
        );
      }
    }
    inserir("importacao_lista", { tipo: "Miguilim", arquivo: nomeArquivo, periodo: null, linhas: revistas });
  });
  if (!revistas) throw new Error("Nenhuma revista com ISSN encontrada no arquivo.");
  return { revistas, indexacoes };
}
