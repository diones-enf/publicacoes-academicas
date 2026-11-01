// Tipos e subtipos de publicação (editáveis) e sugestão de subtipo.
import { executar, inserir, todos, um } from "./db";
import { TIPOS_PADRAO } from "./constantes";
import { normalizar } from "./texto";

export interface Tipo {
  id: number;
  chave: string;
  nome: string;
  ordem: number;
  ativo: number;
}
export interface Subtipo {
  id: number;
  tipo_id: number;
  nome: string;
  ordem: number;
  ativo: number;
}

export function criarTiposPadrao(donoId: number) {
  TIPOS_PADRAO.forEach((t, i) => {
    const tipoId = inserir("tipo_publicacao", { dono_id: donoId, chave: t.chave, nome: t.nome, ordem: i });
    t.subtipos.forEach((s, j) => inserir("subtipo_publicacao", { tipo_id: tipoId, nome: s, ordem: j }));
  });
}

export function listarTipos(donoId: number, incluirInativos = false): (Tipo & { subtipos: Subtipo[] })[] {
  const tipos = todos<Tipo>(
    `SELECT id, chave, nome, ordem, ativo FROM tipo_publicacao WHERE dono_id = ? ${incluirInativos ? "" : "AND ativo = 1"} ORDER BY ordem, id`,
    donoId,
  );
  const subs = todos<Subtipo>(
    `SELECT s.id, s.tipo_id, s.nome, s.ordem, s.ativo FROM subtipo_publicacao s
       JOIN tipo_publicacao t ON t.id = s.tipo_id
      WHERE t.dono_id = ? ${incluirInativos ? "" : "AND s.ativo = 1"} ORDER BY s.ordem, s.id`,
    donoId,
  );
  return tipos.map((t) => ({ ...t, subtipos: subs.filter((s) => s.tipo_id === t.id) }));
}

export function tipoPorChave(donoId: number, chave: string): Tipo | undefined {
  return um<Tipo>("SELECT * FROM tipo_publicacao WHERE dono_id = ? AND chave = ? ORDER BY id LIMIT 1", donoId, chave);
}

export function tipoDoDono(donoId: number, tipoId: number): Tipo | undefined {
  return um<Tipo>("SELECT * FROM tipo_publicacao WHERE dono_id = ? AND id = ?", donoId, tipoId);
}

export function subtipoPorNome(tipoId: number, nome: string): Subtipo | undefined {
  const alvo = normalizar(nome);
  return todos<Subtipo>("SELECT * FROM subtipo_publicacao WHERE tipo_id = ?", tipoId).find(
    (s) => normalizar(s.nome) === alvo,
  );
}

export function salvarTipo(donoId: number, d: { id?: number; nome: string; chave?: string; ativo?: boolean }) {
  if (!d.nome.trim()) throw new Error("Informe o nome do tipo.");
  if (d.id) {
    if (!tipoDoDono(donoId, d.id)) throw new Error("Tipo não encontrado.");
    executar("UPDATE tipo_publicacao SET nome = ?, ativo = ? WHERE id = ?", d.nome.trim(), d.ativo !== false, d.id);
    return d.id;
  }
  const ordem = (um<{ m: number }>("SELECT COALESCE(MAX(ordem),0)+1 m FROM tipo_publicacao WHERE dono_id = ?", donoId)?.m ?? 0);
  return inserir("tipo_publicacao", { dono_id: donoId, chave: d.chave || "outro", nome: d.nome.trim(), ordem });
}

export function salvarSubtipo(donoId: number, d: { id?: number; tipo_id: number; nome: string; ativo?: boolean }) {
  if (!tipoDoDono(donoId, d.tipo_id)) throw new Error("Tipo não encontrado.");
  if (!d.nome.trim()) throw new Error("Informe o nome do subtipo.");
  if (d.id) {
    executar(
      "UPDATE subtipo_publicacao SET nome = ?, ativo = ? WHERE id = ? AND tipo_id = ?",
      d.nome.trim(),
      d.ativo !== false,
      d.id,
      d.tipo_id,
    );
    return d.id;
  }
  const ordem = um<{ m: number }>("SELECT COALESCE(MAX(ordem),0)+1 m FROM subtipo_publicacao WHERE tipo_id = ?", d.tipo_id)?.m ?? 0;
  return inserir("subtipo_publicacao", { tipo_id: d.tipo_id, nome: d.nome.trim(), ordem });
}

// ---------- Sugestão de subtipo ----------

const PISTAS: { subtipo: string; termos: string[] }[] = [
  { subtipo: "Metanálise", termos: ["metanalise", "meta analise", "meta analysis", "metaanalysis", "metaanalisis"] },
  { subtipo: "Revisão sistemática", termos: ["revisao sistematica", "systematic review", "revision sistematica"] },
  { subtipo: "Revisão de escopo", termos: ["revisao de escopo", "scoping review", "revision de alcance", "scoping"] },
  { subtipo: "Revisão integrativa", termos: ["revisao integrativa", "integrative review", "revision integrativa"] },
  {
    subtipo: "Revisão narrativa/bibliográfica",
    termos: ["revisao narrativa", "revisao bibliografica", "narrative review", "literature review", "revisao de literatura"],
  },
  { subtipo: "Relato de experiência", termos: ["relato de experiencia", "experience report", "relato de experiencia"] },
  { subtipo: "Relato de caso", termos: ["relato de caso", "case report", "estudo de caso clinico"] },
  { subtipo: "Editorial", termos: ["editorial"] },
  { subtipo: "Carta ao editor", termos: ["carta ao editor", "letter to the editor", "carta al editor"] },
  { subtipo: "Opinião/ensaio/reflexão", termos: ["reflexao", "ensaio teorico", "reflection", "artigo de reflexao", "ensayo"] },
];

/**
 * Sugere o subtipo a partir do título e do resumo. É só uma sugestão: o
 * formulário sempre pede confirmação. Sem pistas, sugere "Original/pesquisa"
 * quando houver resumo.
 */
export function sugerirSubtipo(titulo: string, resumo?: string | null): string | null {
  const texto = ` ${normalizar(titulo)} ${normalizar(resumo ?? "")} `;
  for (const p of PISTAS) {
    if (p.termos.some((t) => texto.includes(` ${t} `) || texto.includes(` ${t}`))) return p.subtipo;
  }
  return resumo && resumo.length > 200 ? "Original/pesquisa" : null;
}
