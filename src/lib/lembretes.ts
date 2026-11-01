// Lembretes: 7 e 2 dias antes de prazos de resposta e de pagamento, e
// aviso de item parado há N dias (90 por padrão, ajustável).
import { executar, inserir, todos, um } from "./db";
import { STATUS_SUBMISSOES } from "./constantes";
import { dataBr, diasEntre, hojeIso, reais, somarDias } from "./texto";
import { emailConfigurado, enviarEmail } from "./email";

export const ANTECEDENCIAS = [7, 2];

export interface Lembrete {
  id: number;
  publicacao_id: number | null;
  lancamento_id: number | null;
  tipo: string;
  data_alvo: string;
  antecedencia: number | null;
  mensagem: string;
  lido: number;
  criado_em: string;
}

function criarSeNaoExiste(d: {
  dono_id: number;
  tipo: string;
  publicacao_id: number | null;
  lancamento_id: number | null;
  data_alvo: string;
  antecedencia: number | null;
  mensagem: string;
}): number | null {
  const existe = um(
    `SELECT 1 FROM lembrete WHERE dono_id = ? AND tipo = ? AND COALESCE(publicacao_id,0) = ? AND COALESCE(lancamento_id,0) = ?
       AND data_alvo = ? AND COALESCE(antecedencia,0) = ?`,
    d.dono_id,
    d.tipo,
    d.publicacao_id ?? 0,
    d.lancamento_id ?? 0,
    d.data_alvo,
    d.antecedencia ?? 0,
  );
  if (existe) return null;
  return inserir("lembrete", d);
}

/** Antecedências que já venceram para um prazo (ex.: faltam 5 dias -> [7]; faltam 2 -> [7, 2] ou só [2]). */
export function antecedenciasDevidas(diasRestantes: number): number[] {
  if (diasRestantes < 0) return [];
  return ANTECEDENCIAS.filter((a) => diasRestantes <= a && (a === Math.min(...ANTECEDENCIAS) || diasRestantes > Math.min(...ANTECEDENCIAS)));
}

export function gerarLembretes(donoId: number, hoje = hojeIso()): number[] {
  const novos: number[] = [];
  const st = STATUS_SUBMISSOES;
  // Prazos de resposta a pareceres
  for (const p of todos<{ id: number; titulo: string; prazo_resposta: string }>(
    `SELECT id, titulo, prazo_resposta FROM publicacao WHERE dono_id = ? AND prazo_resposta IS NOT NULL AND status IN (${st.map(() => "?").join(",")})`,
    donoId,
    ...st,
  )) {
    const dias = diasEntre(hoje, p.prazo_resposta);
    for (const a of antecedenciasDevidas(dias)) {
      const id = criarSeNaoExiste({
        dono_id: donoId,
        tipo: "prazo_resposta",
        publicacao_id: p.id,
        lancamento_id: null,
        data_alvo: p.prazo_resposta,
        antecedencia: a,
        mensagem: `Faltam ${dias} dia(s) para o prazo de resposta aos pareceres (${dataBr(p.prazo_resposta)}): "${p.titulo}".`,
      });
      if (id) novos.push(id);
    }
  }
  // Pagamentos previstos
  for (const l of todos<{ id: number; publicacao_id: number | null; tipo: string; data_vencimento: string; parte_autor_brl: number; titulo: string | null }>(
    `SELECT l.id, l.publicacao_id, l.tipo, l.data_vencimento, l.parte_autor_brl, p.titulo FROM lancamento_custo l
       LEFT JOIN publicacao p ON p.id = l.publicacao_id
      WHERE l.dono_id = ? AND l.data_pagamento IS NULL AND l.data_vencimento IS NOT NULL AND l.valor > 0`,
    donoId,
  )) {
    const dias = diasEntre(hoje, l.data_vencimento);
    for (const a of antecedenciasDevidas(dias)) {
      const id = criarSeNaoExiste({
        dono_id: donoId,
        tipo: "pagamento",
        publicacao_id: l.publicacao_id,
        lancamento_id: l.id,
        data_alvo: l.data_vencimento,
        antecedencia: a,
        mensagem: `Faltam ${dias} dia(s) para pagar ${l.tipo} de ${reais(l.parte_autor_brl)} (${dataBr(l.data_vencimento)})${l.titulo ? `: "${l.titulo}"` : ""}.`,
      });
      if (id) novos.push(id);
    }
  }
  // Itens parados
  const limite = um<{ dias_sem_movimentacao: number }>("SELECT dias_sem_movimentacao FROM usuario WHERE id = ?", donoId)?.dias_sem_movimentacao ?? 90;
  const parados = ["Submetido", "Em avaliação", "Em revisão", "Aceito"];
  for (const p of todos<{ id: number; titulo: string; ultima_movimentacao: string; veiculo: string | null }>(
    `SELECT p.id, p.titulo, p.ultima_movimentacao, v.nome AS veiculo FROM publicacao p LEFT JOIN veiculo v ON v.id = p.veiculo_id
      WHERE p.dono_id = ? AND p.ultima_movimentacao IS NOT NULL AND p.status IN (${parados.map(() => "?").join(",")})`,
    donoId,
    ...parados,
  )) {
    const dias = diasEntre(p.ultima_movimentacao, hoje);
    if (dias < limite) continue;
    const id = criarSeNaoExiste({
      dono_id: donoId,
      tipo: "sem_movimentacao",
      publicacao_id: p.id,
      lancamento_id: null,
      data_alvo: somarDias(p.ultima_movimentacao, limite),
      antecedencia: null,
      mensagem: `"${p.titulo}" está há ${dias} dias sem movimentação${p.veiculo ? ` na ${p.veiculo}` : ""}. Que tal cobrar a revista?`,
    });
    if (id) novos.push(id);
  }
  return novos;
}

export function listarLembretes(donoId: number, apenasNaoLidos = true): Lembrete[] {
  return todos<Lembrete>(
    `SELECT * FROM lembrete WHERE dono_id = ? ${apenasNaoLidos ? "AND lido = 0" : ""} ORDER BY data_alvo, id`,
    donoId,
  );
}

export function marcarLembreteLido(donoId: number, id: number) {
  executar("UPDATE lembrete SET lido = 1 WHERE id = ? AND dono_id = ?", id, donoId);
}

export async function enviarLembretesPorEmail(donoId: number) {
  if (!emailConfigurado()) return;
  const u = um<{ email: string | null }>("SELECT email FROM usuario WHERE id = ?", donoId);
  if (!u?.email) return;
  const pend = todos<Lembrete>("SELECT * FROM lembrete WHERE dono_id = ? AND email_enviado = 0 AND lido = 0", donoId);
  if (!pend.length) return;
  const ok = await enviarEmail(u.email, `Publicações: ${pend.length} lembrete(s)`, pend.map((l) => `• ${l.mensagem}`).join("\n"));
  if (ok) executar(`UPDATE lembrete SET email_enviado = 1 WHERE id IN (${pend.map(() => "?").join(",")})`, ...pend.map((l) => l.id));
}
