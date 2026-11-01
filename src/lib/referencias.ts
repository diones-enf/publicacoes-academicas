// Referências formatadas em ABNT NBR 6023 e Vancouver.
import type { LinhaLista } from "./filtros";

interface NomePartes {
  sobrenome: string;
  prenomes: string[];
}

export function partesDoNome(nome: string): NomePartes {
  const n = nome.trim();
  if (n.includes(",")) {
    const [s, resto = ""] = n.split(",", 2);
    return { sobrenome: s.trim(), prenomes: resto.split(/[\s.]+/).filter(Boolean) };
  }
  const partes = n.split(/\s+/).filter(Boolean);
  const sobrenome = partes.pop() ?? "";
  return { sobrenome, prenomes: partes };
}

const PREP = new Set(["da", "de", "do", "das", "dos", "e"]);

function iniciais(prenomes: string[], comPonto: boolean): string {
  return prenomes
    .filter((p) => !PREP.has(p.toLowerCase()))
    .map((p) => p[0].toUpperCase() + (comPonto ? "." : ""))
    .join(comPonto ? " " : "");
}

export function autorAbnt(nome: string): string {
  const p = partesDoNome(nome);
  const ini = iniciais(p.prenomes, true);
  return `${p.sobrenome.toUpperCase()}${ini ? ", " + ini : ""}`;
}

export function autorVancouver(nome: string): string {
  const p = partesDoNome(nome);
  const sob = p.sobrenome.charAt(0).toUpperCase() + p.sobrenome.slice(1).toLowerCase();
  const sobrenome = p.sobrenome === p.sobrenome.toUpperCase() ? sob : p.sobrenome;
  return `${sobrenome} ${iniciais(p.prenomes, false)}`.trim();
}

function autoresDe(l: LinhaLista): string[] {
  return l.autores ? l.autores.split("; ").filter(Boolean) : [];
}

function listaAbnt(autores: string[]): string {
  if (!autores.length) return "";
  if (autores.length > 3) return `${autorAbnt(autores[0])} et al.`;
  return ponto(autores.map(autorAbnt).join("; "));
}

function paginasAbnt(p: string | null): string {
  if (!p) return "";
  return /^\d+(-\d+)?$/.test(p) ? `p. ${p}` : p.startsWith("e") ? p : `e${p}`;
}

function ponto(s: string): string {
  const t = s.trim();
  return t.endsWith(".") || t.endsWith("?") || t.endsWith("!") ? t : `${t}.`;
}

function linkDoi(doi: string | null): string {
  return doi ? ` DOI: https://doi.org/${doi}.` : "";
}

/** Referência em ABNT NBR 6023. Usa ** ** para marcar o destaque (negrito). */
export function referenciaAbnt(l: LinhaLista): string {
  const autores = listaAbnt(autoresDe(l));
  const ano = l.ano ?? (l.data_publicacao ? l.data_publicacao.slice(0, 4) : "[s.d.]");
  const partes = [autores, ponto(l.titulo)].filter(Boolean);
  switch (l.tipo_chave) {
    case "artigo": {
      const det = [
        l.volume ? `v. ${l.volume}` : "",
        l.numero ? `n. ${l.numero}` : "",
        paginasAbnt(l.paginas),
        String(ano),
      ].filter(Boolean);
      return `${partes.join(" ")} **${l.veiculo ?? "[Revista não informada]"}**, ${det.join(", ")}.${linkDoi(l.doi)}`;
    }
    case "livro": {
      const local = `${l.cidade || "[S. l.]"}: ${l.editora || l.veiculo_editora || "[s. n.]"}, ${ano}`;
      return `${autores} **${ponto(l.titulo).replace(/\.$/, "")}**. ${l.edicao ? `${l.edicao} ed. ` : ""}${local}.${l.isbn ? ` ISBN ${l.isbn}.` : ""}${linkDoi(l.doi)}`.trim();
    }
    case "capitulo": {
      const org = l.organizadores ? `${l.organizadores.split(";").map((o) => autorAbnt(o)).join("; ")} (org.). ` : "";
      const local = `${l.cidade || "[S. l.]"}: ${l.editora || "[s. n.]"}, ${ano}`;
      return `${partes.join(" ")} In: ${org}**${l.livro_titulo ?? "[Livro não informado]"}**. ${local}. ${paginasAbnt(l.paginas)}${l.paginas ? "." : ""}${linkDoi(l.doi)}`.replace(/\s+/g, " ").trim();
    }
    case "anais": {
      const ev = (l.evento ?? "[Evento não informado]").toUpperCase();
      const local = l.evento_cidade || "[S. l.]";
      return `${partes.join(" ")} In: ${ev}${l.edicao ? `, ${l.edicao}` : ""}, ${ano}, ${local}. **Anais** [...]. ${local}, ${ano}. ${paginasAbnt(l.paginas)}${l.paginas ? "." : ""}${linkDoi(l.doi)}`.replace(/\s+/g, " ").trim();
    }
    case "apresentacao":
      return `${partes.join(" ")} Apresentação de trabalho${l.modalidade ? ` (${l.modalidade.toLowerCase()})` : ""} no ${l.evento ?? "[evento]"}, ${l.evento_cidade ?? "[S. l.]"}, ${ano}.`;
    case "jornal":
      return `${partes.join(" ")} **${l.veiculo ?? "[Veículo]"}**, ${l.data_publicacao ? l.data_publicacao.split("-").reverse().join("/") : ano}.${l.link ? ` Disponível em: ${l.link}.` : ""}`;
    default:
      return `${partes.join(" ")} ${[l.veiculo, l.evento].filter(Boolean).join(", ")}${l.veiculo || l.evento ? ", " : ""}${ano}.${linkDoi(l.doi)}`.trim();
  }
}

/** Referência no estilo Vancouver (ICMJE/NLM). */
export function referenciaVancouver(l: LinhaLista): string {
  const lista = autoresDe(l);
  const autores = lista.length
    ? (lista.length > 6 ? [...lista.slice(0, 6).map(autorVancouver), "et al"] : lista.map(autorVancouver)).join(", ") + "."
    : "";
  const ano = l.ano ?? "";
  const titulo = ponto(l.titulo);
  const doi = l.doi ? ` doi:${l.doi}` : "";
  switch (l.tipo_chave) {
    case "artigo": {
      const vol = `${l.volume ?? ""}${l.numero ? `(${l.numero})` : ""}`;
      return `${autores} ${titulo} ${l.veiculo ?? ""}. ${ano}${vol ? `;${vol}` : ""}${l.paginas ? `:${l.paginas}` : ""}.${doi}`.trim();
    }
    case "livro":
      return `${autores} ${titulo} ${l.edicao ? `${l.edicao} ed. ` : ""}${l.cidade ?? ""}${l.cidade ? ": " : ""}${l.editora ?? ""}; ${ano}.${doi}`.trim();
    case "capitulo":
      return `${autores} ${titulo} In: ${l.organizadores ? `${l.organizadores}, editors. ` : ""}${l.livro_titulo ?? ""}. ${l.cidade ?? ""}${l.cidade ? ": " : ""}${l.editora ?? ""}; ${ano}.${l.paginas ? ` p. ${l.paginas}.` : ""}${doi}`.trim();
    case "anais":
    case "apresentacao":
      return `${autores} ${titulo} In: ${l.evento ?? ""}; ${ano}${l.evento_cidade ? `; ${l.evento_cidade}` : ""}.${l.paginas ? ` p. ${l.paginas}.` : ""}${doi}`.trim();
    default:
      return `${autores} ${titulo} ${l.veiculo ?? l.evento ?? ""}${l.veiculo || l.evento ? ". " : ""}${ano}.${doi}`.trim();
  }
}
