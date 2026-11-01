// Banco de dados local em um único arquivo SQLite (módulo nativo do Node,
// sem instalar nada além do Node). Fica em dados/publicacoes.db.
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { MIGRACOES } from "./schema";

let banco: DatabaseSync | null = null;

export function pastaDados(): string {
  const p = process.env.PASTA_DADOS || path.join(process.cwd(), "dados");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function caminhoBanco(): string {
  return process.env.ARQUIVO_BANCO || path.join(pastaDados(), "publicacoes.db");
}

export function db(): DatabaseSync {
  if (banco) return banco;
  const arquivo = caminhoBanco();
  banco = new DatabaseSync(arquivo);
  banco.exec("PRAGMA foreign_keys = ON;");
  if (arquivo !== ":memory:") banco.exec("PRAGMA journal_mode = WAL;");
  migrar(banco);
  return banco;
}

/** Usado nos testes: abre um banco novo em memória. */
export function usarBancoEmMemoria(): DatabaseSync {
  banco?.close();
  banco = new DatabaseSync(":memory:");
  banco.exec("PRAGMA foreign_keys = ON;");
  migrar(banco);
  return banco;
}

export function fecharBanco() {
  banco?.close();
  banco = null;
}

function migrar(d: DatabaseSync) {
  d.exec("CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT)");
  const linha = d.prepare("SELECT valor FROM meta WHERE chave = 'versao_esquema'").get() as
    | { valor: string }
    | undefined;
  let versao = linha ? Number(linha.valor) : 0;
  for (let i = versao; i < MIGRACOES.length; i++) {
    d.exec("BEGIN");
    try {
      d.exec(MIGRACOES[i]);
      versao = i + 1;
      d.prepare(
        "INSERT INTO meta (chave, valor) VALUES ('versao_esquema', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
      ).run(String(versao));
      d.exec("COMMIT");
    } catch (e) {
      d.exec("ROLLBACK");
      throw e;
    }
  }
}

// ---------- Atalhos ----------

type Params = SQLInputValue[];
export type Linha = Record<string, unknown>;

function limpar(params: unknown[]): Params {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    return p as SQLInputValue;
  });
}

export function todos<T = Linha>(sql: string, ...params: unknown[]): T[] {
  return db().prepare(sql).all(...limpar(params)) as T[];
}

export function um<T = Linha>(sql: string, ...params: unknown[]): T | undefined {
  return db().prepare(sql).get(...limpar(params)) as T | undefined;
}

export function executar(sql: string, ...params: unknown[]): { id: number; alteradas: number } {
  const r = db().prepare(sql).run(...limpar(params));
  return { id: Number(r.lastInsertRowid), alteradas: Number(r.changes) };
}

/** Insere um objeto numa tabela e devolve o id. */
export function inserir(tabela: string, dados: Record<string, unknown>): number {
  const campos = Object.keys(dados);
  const sql = `INSERT INTO ${tabela} (${campos.join(", ")}) VALUES (${campos.map(() => "?").join(", ")})`;
  return executar(sql, ...campos.map((c) => dados[c])).id;
}

export function atualizar(tabela: string, id: number, dados: Record<string, unknown>) {
  const campos = Object.keys(dados);
  if (!campos.length) return;
  executar(
    `UPDATE ${tabela} SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    ...campos.map((c) => dados[c]),
    id,
  );
}

/** Executa várias operações como uma só: ou tudo grava, ou nada grava. */
export function transacao<T>(fn: () => T): T {
  const d = db();
  if (d.isTransaction) return fn();
  d.exec("BEGIN");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export function metaLer(chave: string): string | null {
  return um<{ valor: string }>("SELECT valor FROM meta WHERE chave = ?", chave)?.valor ?? null;
}

export function metaGravar(chave: string, valor: string) {
  executar(
    "INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
    chave,
    valor,
  );
}
