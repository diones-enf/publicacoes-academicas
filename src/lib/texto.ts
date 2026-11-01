// Funções de texto usadas em todo o sistema: normalização, CPF, DOI, ISBN,
// ISSN, similaridade de títulos e formatação no padrão brasileiro.

/** Remove acentos, pontuação e caixa: "Revisão: Integrativa!" -> "revisao integrativa". */
export function normalizar(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ") // tags que o Crossref às vezes manda no título
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// ---------- CPF ----------

export function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

export function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(d.slice(0, 9), 10) === Number(d[9]) && calc(d.slice(0, 10), 11) === Number(d[10]);
}

export function formatarCpf(cpf: string): string {
  const d = soDigitos(cpf).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** "12345678909" -> "***.456.789-**" */
export function mascararCpf(cpf: string): string {
  const d = soDigitos(cpf);
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

// ---------- Identificadores ----------

/** Aceita "10.xxxx/...", "doi:10...", "https://doi.org/10..." e devolve "10.xxxx/..." em minúsculas. */
export function normalizarDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  let d = doi.trim();
  try {
    d = decodeURIComponent(d);
  } catch {
    /* mantém como veio */
  }
  d = d
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^(dx\.)?doi\.org\//i, "")
    .trim()
    .replace(/[.,;\s]+$/, "")
    .toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(d) ? d : null;
}

/** Procura um DOI dentro de um texto livre. */
export function encontrarDoi(texto: string): string | null {
  const m = texto.match(/10\.\d{4,9}\/[^\s"<>]+/i);
  return m ? normalizarDoi(m[0]) : null;
}

export function normalizarIsbn(isbn: string | null | undefined): string | null {
  const d = (isbn ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();
  return d.length === 10 || d.length === 13 ? d : null;
}

export function normalizarIssn(issn: string | null | undefined): string | null {
  const d = (issn ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (d.length !== 8) return null;
  return `${d.slice(0, 4)}-${d.slice(4)}`;
}

/** Confere o dígito verificador do ISSN. */
export function issnValido(issn: string | null | undefined): boolean {
  const n = normalizarIssn(issn);
  if (!n) return false;
  const d = n.replace("-", "");
  let soma = 0;
  for (let i = 0; i < 7; i++) soma += Number(d[i]) * (8 - i);
  const resto = 11 - (soma % 11);
  const dv = resto === 11 ? "0" : resto === 10 ? "X" : String(resto);
  return dv === d[7];
}

export function normalizarOrcid(orcid: string | null | undefined): string | null {
  const m = (orcid ?? "").toUpperCase().match(/(\d{4})-?(\d{4})-?(\d{4})-?(\d{3}[\dX])/);
  return m ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}` : null;
}

// ---------- Similaridade ----------

/** Distância de edição (Levenshtein) com duas linhas de memória. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Similaridade de 0 a 1 entre dois textos, depois de normalizar. */
export function similaridade(a: string, b: string): number {
  const x = normalizar(a);
  const y = normalizar(b);
  if (!x && !y) return 1;
  const max = Math.max(x.length, y.length);
  return max === 0 ? 1 : 1 - distancia(x, y) / max;
}

// ---------- Nomes de autores ----------

/** Gera a forma de citação "SOBRENOME, I. N." a partir do nome completo. */
export function nomeEmCitacao(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (nomeCompleto.includes(",")) return nomeCompleto.trim().toUpperCase();
  const sobrenome = partes.pop()!;
  const preposicoes = new Set(["da", "de", "do", "das", "dos", "e"]);
  const iniciais = partes
    .filter((p) => !preposicoes.has(p.toLowerCase()))
    .map((p) => p[0].toUpperCase() + ".")
    .join(" ");
  return `${sobrenome.toUpperCase()}${iniciais ? ", " + iniciais : ""}`;
}

/**
 * Chave para comparar nomes de autor independentemente da grafia:
 * sobrenome normalizado + iniciais dos prenomes. "Schiavão, L." e
 * "Luana Schiavao" dão a mesma chave "schiavao l".
 */
export function chaveNome(nome: string): string {
  const n = nome.trim();
  let sobrenome: string;
  let prenomes: string[];
  if (n.includes(",")) {
    const [s, resto] = n.split(",", 2);
    sobrenome = s;
    prenomes = (resto ?? "").split(/[\s.]+/).filter(Boolean);
  } else {
    const partes = n.split(/\s+/).filter(Boolean);
    sobrenome = partes.pop() ?? "";
    prenomes = partes;
  }
  const preposicoes = new Set(["da", "de", "do", "das", "dos", "e"]);
  const iniciais = prenomes
    .map((p) => normalizar(p))
    .filter((p) => p && !preposicoes.has(p))
    .map((p) => p[0])
    .join("");
  return `${normalizar(sobrenome)} ${iniciais}`.trim();
}

/** Primeira inicial apenas — usada para comparar "ROSA, D." com "ROSA, D. R.". */
export function chaveNomeCurta(nome: string): string {
  const [sobrenome, iniciais = ""] = chaveNome(nome).split(" ");
  return `${sobrenome} ${iniciais.slice(0, 1)}`.trim();
}

// ---------- Datas e valores (padrão brasileiro) ----------

/** "2026-03-05" -> "05/03/2026" */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** "05/03/2026" -> "2026-03-05" (aceita também ISO). */
export function dataIso(br: string | null | undefined): string | null {
  if (!br) return null;
  const s = br.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "2026-03" -> "03/2026" */
export function competenciaBr(c: string | null | undefined): string {
  if (!c) return "";
  const m = c.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : c;
}

const formatoReal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function reais(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return formatoReal.format(v);
}

export function hojeIso(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function diasEntre(deIso: string, ateIso: string): number {
  const a = Date.parse(deIso.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(ateIso.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

export function somarDias(iso: string, dias: number): string {
  const t = Date.parse(iso.slice(0, 10) + "T00:00:00Z") + dias * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Quadriênio CAPES de um ano: 2022 -> "2021-2024". */
export function quadrienio(ano: number): string {
  const inicio = 2017 + Math.floor((ano - 2017) / 4) * 4;
  return `${inicio}-${inicio + 3}`;
}
