// Open Library — dados de livros por ISBN (complemento quando o livro não tem DOI).
// A base do ISBN Brasil não tem API pública aberta; por isso fica de fora.
import { buscarJson } from "./http";
import type { Metadados } from "./tipos";

interface OlLivro {
  title?: string;
  subtitle?: string;
  authors?: { name: string }[];
  publishers?: { name: string }[];
  publish_date?: string;
  publish_places?: { name: string }[];
  number_of_pages?: number;
  url?: string;
}

export async function openLibraryPorIsbn(isbn: string): Promise<Metadados | null> {
  const chave = `ISBN:${isbn}`;
  const r = await buscarJson<Record<string, OlLivro>>(
    "Open Library",
    `https://openlibrary.org/api/books?bibkeys=${chave}&format=json&jscmd=data`,
  );
  const l = r?.[chave];
  if (!l) return null;
  const ano = l.publish_date?.match(/\d{4}/)?.[0];
  return {
    fonte: "Open Library",
    titulo: [l.title, l.subtitle].filter(Boolean).join(": ") || null,
    autores: (l.authors ?? []).map((a) => ({ nome: a.name })),
    editora: l.publishers?.[0]?.name ?? null,
    ano: ano ? Number(ano) : null,
    data_publicacao: ano ? `${ano}-01-01` : null,
    paginas: l.number_of_pages ? String(l.number_of_pages) : null,
    isbn,
    link: l.url ?? null,
    tipo_chave: "livro",
  };
}
