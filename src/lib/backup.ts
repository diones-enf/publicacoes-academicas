// Backup diário automático (cópia do banco) e exportação completa em JSON e XLSX.
import fs from "node:fs";
import path from "node:path";
import { db, pastaDados, todos, executar } from "./db";
import { hojeIso } from "./texto";

const MANTER = 30;

export function pastaBackups(): string {
  const p = path.join(pastaDados(), "backups");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

/** Copia o banco inteiro para dados/backups/publicacoes-AAAA-MM-DD.db (e para a pasta extra, se configurada). */
export function fazerBackup(): string {
  const destino = path.join(pastaBackups(), `publicacoes-${hojeIso()}.db`);
  if (fs.existsSync(destino)) fs.rmSync(destino);
  db().exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  const extra = process.env.PASTA_BACKUP_EXTRA;
  if (extra) {
    try {
      fs.mkdirSync(extra, { recursive: true });
      fs.copyFileSync(destino, path.join(extra, path.basename(destino)));
    } catch (e) {
      console.error("Não foi possível copiar o backup para a pasta extra:", (e as Error).message);
    }
  }
  const antigos = fs
    .readdirSync(pastaBackups())
    .filter((f) => /^publicacoes-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .reverse()
    .slice(MANTER);
  for (const f of antigos) fs.rmSync(path.join(pastaBackups(), f));
  return destino;
}

export function listarBackups() {
  return fs
    .readdirSync(pastaBackups())
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse()
    .map((f) => ({ arquivo: f, tamanho: fs.statSync(path.join(pastaBackups(), f)).size }));
}

/** Tabelas com os dados do autor e a consulta que separa só o que é dele. */
const TABELAS_DONO: [string, string][] = [
  ["usuario", "SELECT id, perfil, cpf_mascara, nome, nomes_citacao, orcid, lattes_id, email, data_nascimento, area_qualis_ref, dias_sem_movimentacao, consentimento_em, criado_em FROM usuario WHERE id = ?1 OR dono_id = ?1"],
  ["tipo_publicacao", "SELECT * FROM tipo_publicacao WHERE dono_id = ?1"],
  ["subtipo_publicacao", "SELECT s.* FROM subtipo_publicacao s JOIN tipo_publicacao t ON t.id = s.tipo_id WHERE t.dono_id = ?1"],
  ["veiculo", "SELECT * FROM veiculo WHERE dono_id = ?1"],
  ["metrica_veiculo", "SELECT m.* FROM metrica_veiculo m JOIN veiculo v ON v.id = m.veiculo_id WHERE v.dono_id = ?1"],
  ["indexacao_veiculo", "SELECT i.* FROM indexacao_veiculo i JOIN veiculo v ON v.id = i.veiculo_id WHERE v.dono_id = ?1"],
  ["evento", "SELECT * FROM evento WHERE dono_id = ?1"],
  ["publicacao", "SELECT * FROM publicacao WHERE dono_id = ?1"],
  ["coautor", "SELECT * FROM coautor WHERE dono_id = ?1"],
  ["coautor_variacao", "SELECT v.* FROM coautor_variacao v JOIN coautor c ON c.id = v.coautor_id WHERE c.dono_id = ?1"],
  ["autoria", "SELECT a.* FROM autoria a JOIN publicacao p ON p.id = a.publicacao_id WHERE p.dono_id = ?1"],
  ["lancamento_custo", "SELECT * FROM lancamento_custo WHERE dono_id = ?1"],
  ["historico_status", "SELECT h.* FROM historico_status h JOIN publicacao p ON p.id = h.publicacao_id WHERE p.dono_id = ?1"],
  ["tentativa_submissao", "SELECT t.* FROM tentativa_submissao t JOIN publicacao p ON p.id = t.publicacao_id WHERE p.dono_id = ?1"],
  ["versao_relacionada", "SELECT r.* FROM versao_relacionada r JOIN publicacao p ON p.id = r.a_id WHERE p.dono_id = ?1"],
  ["origem_campo", "SELECT o.* FROM origem_campo o JOIN publicacao p ON p.id = o.publicacao_id WHERE p.dono_id = ?1"],
  ["historico_alteracao", "SELECT * FROM historico_alteracao WHERE dono_id = ?1"],
  ["lembrete", "SELECT * FROM lembrete WHERE dono_id = ?1"],
  ["visao_salva", "SELECT * FROM visao_salva WHERE dono_id = ?1"],
  ["log_acesso", "SELECT * FROM log_acesso WHERE usuario_id = ?1 OR usuario_id IN (SELECT id FROM usuario WHERE dono_id = ?1)"],
];

export function exportarDados(donoId: number): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = { _exportado_em: [new Date().toISOString()] };
  for (const [t, sql] of TABELAS_DONO) out[t] = todos(sql, donoId);
  return out;
}

export async function exportarXlsxCompleto(donoId: number): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const dados = exportarDados(donoId);
  for (const [t, linhas] of Object.entries(dados)) {
    if (t.startsWith("_")) continue;
    const ws = wb.addWorksheet(t.slice(0, 31));
    const l = linhas as Record<string, unknown>[];
    if (!l.length) continue;
    const colunas = Object.keys(l[0]);
    ws.addRow(colunas).font = { bold: true };
    for (const r of l) ws.addRow(colunas.map((c) => r[c] as never));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** LGPD: apaga a conta do autor e tudo ligado a ela (leitores, publicações, custos...). */
export function excluirTodosOsDados(autorId: number) {
  executar("DELETE FROM historico_alteracao WHERE dono_id = ?", autorId);
  executar("DELETE FROM log_acesso WHERE usuario_id = ? OR usuario_id IN (SELECT id FROM usuario WHERE dono_id = ?)", autorId, autorId);
  executar("DELETE FROM publicacao WHERE dono_id = ?", autorId);
  executar("DELETE FROM usuario WHERE dono_id = ?", autorId);
  executar("DELETE FROM usuario WHERE id = ?", autorId);
}
