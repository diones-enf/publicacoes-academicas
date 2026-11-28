// Anexos das publicações. Os arquivos ficam na pasta de dados (Documentos\Publicacoes-Academicas-dados\anexos),
// fora da pasta do programa, para nunca se perderem numa atualização.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { executar, inserir, pastaDados, todos, um } from "./db";
import { CATEGORIAS_ANEXO, LIMITE_ANEXO_MB } from "./constantes";
export { CATEGORIAS_ANEXO, CATEGORIA_DO_STATUS } from "./constantes";

export const LIMITE_MB = LIMITE_ANEXO_MB;

export interface Anexo {
  id: number;
  publicacao_id: number;
  categoria: string;
  nome_original: string;
  arquivo: string;
  tamanho: number;
  tipo_mime: string | null;
  status_na_hora: string | null;
  observacao: string | null;
  criado_em: string;
}

export function pastaAnexos(): string {
  const p = path.join(pastaDados(), "anexos");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

/** Só o nome do arquivo, sem pastas (Windows ou não). */
function soNome(nome: string): string {
  return nome.split(/[\\/]/).pop()!.trim();
}

function nomeSeguro(nome: string): string {
  const base = soNome(nome).normalize("NFD").replace(/[̀-ͯ]/g, "");
  return base.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(-120) || "arquivo";
}

function publicacaoDoDono(donoId: number, publicacaoId: number) {
  const p = um<{ id: number; status: string }>("SELECT id, status FROM publicacao WHERE id = ? AND dono_id = ?", publicacaoId, donoId);
  if (!p) throw new Error("Publicação não encontrada.");
  return p;
}

export function salvarAnexo(
  donoId: number,
  publicacaoId: number,
  arquivo: { nome: string; conteudo: Buffer; tipo?: string | null },
  categoria: string,
  observacao?: string | null,
): number {
  const p = publicacaoDoDono(donoId, publicacaoId);
  if (!arquivo.conteudo.length) throw new Error(`O arquivo "${arquivo.nome}" está vazio.`);
  if (arquivo.conteudo.length > LIMITE_MB * 1024 * 1024) throw new Error(`O arquivo "${arquivo.nome}" passa de ${LIMITE_MB} MB.`);
  const cat = CATEGORIAS_ANEXO.includes(categoria) ? categoria : "Outro";
  const rel = path.join(String(publicacaoId), `${crypto.randomBytes(6).toString("hex")}-${nomeSeguro(arquivo.nome)}`);
  const destino = path.join(pastaAnexos(), rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, arquivo.conteudo);
  return inserir("anexo", {
    publicacao_id: publicacaoId,
    categoria: cat,
    nome_original: soNome(arquivo.nome).slice(-200) || "arquivo",
    arquivo: rel.split(path.sep).join("/"),
    tamanho: arquivo.conteudo.length,
    tipo_mime: arquivo.tipo || null,
    status_na_hora: p.status,
    observacao: observacao?.trim() || null,
  });
}

export function listarAnexos(donoId: number, publicacaoId: number): Anexo[] {
  return todos<Anexo>(
    `SELECT a.* FROM anexo a JOIN publicacao p ON p.id = a.publicacao_id
      WHERE a.publicacao_id = ? AND p.dono_id = ? ORDER BY a.criado_em DESC, a.id DESC`,
    publicacaoId,
    donoId,
  );
}

/** Quantos anexos cada publicação tem (para os cartões). */
export function contarAnexos(donoId: number): Map<number, number> {
  return new Map(
    todos<{ publicacao_id: number; n: number }>(
      "SELECT a.publicacao_id, COUNT(*) n FROM anexo a JOIN publicacao p ON p.id = a.publicacao_id WHERE p.dono_id = ? GROUP BY a.publicacao_id",
      donoId,
    ).map((r) => [r.publicacao_id, r.n]),
  );
}

export function obterAnexo(donoId: number, id: number): (Anexo & { caminho: string }) | null {
  const a = um<Anexo>("SELECT a.* FROM anexo a JOIN publicacao p ON p.id = a.publicacao_id WHERE a.id = ? AND p.dono_id = ?", id, donoId);
  if (!a) return null;
  const caminho = path.join(pastaAnexos(), a.arquivo);
  if (!caminho.startsWith(pastaAnexos())) return null;
  return { ...a, caminho };
}

export function alterarAnexo(donoId: number, id: number, dados: { categoria?: string; observacao?: string | null }) {
  const a = obterAnexo(donoId, id);
  if (!a) throw new Error("Anexo não encontrado.");
  executar(
    "UPDATE anexo SET categoria = ?, observacao = ? WHERE id = ?",
    dados.categoria && CATEGORIAS_ANEXO.includes(dados.categoria) ? dados.categoria : a.categoria,
    dados.observacao === undefined ? a.observacao : dados.observacao?.trim() || null,
    id,
  );
}

export function excluirAnexo(donoId: number, id: number) {
  const a = obterAnexo(donoId, id);
  if (!a) throw new Error("Anexo não encontrado.");
  executar("DELETE FROM anexo WHERE id = ?", id);
  fs.rmSync(a.caminho, { force: true });
}

/** Apaga arquivos que ficaram sem registro (publicação excluída). Roda na rotina diária. */
export function limparAnexosOrfaos(): number {
  const raiz = pastaAnexos();
  const usados = new Set(todos<{ arquivo: string }>("SELECT arquivo FROM anexo").map((r) => r.arquivo));
  let n = 0;
  for (const pasta of fs.readdirSync(raiz)) {
    const dir = path.join(raiz, pasta);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!usados.has(`${pasta}/${f}`)) {
        fs.rmSync(path.join(dir, f), { force: true });
        n++;
      }
    }
    if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
  }
  return n;
}

export function tamanhoLegivel(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
