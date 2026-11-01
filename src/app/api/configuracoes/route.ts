import { cookies } from "next/headers";
import { verify } from "@node-rs/argon2";
import { corpo, numero, rota } from "@/lib/api";
import { executar, um } from "@/lib/db";
import { criarLeitor, ErroAcesso, registrarAcesso, trocarSenha } from "@/lib/auth";
import { salvarSubtipo, salvarTipo } from "@/lib/tipos";
import { excluirTodosOsDados, fazerBackup } from "@/lib/backup";
import { normalizarOrcid } from "@/lib/texto";
import { COOKIE_SESSAO } from "@/lib/sessao";

/** POST { acao, ... } — todas as ações da tela Configurações. */
export const POST = rota(async (req, { usuario, ctx }) => {
  const d = await corpo<Record<string, unknown>>(req);
  switch (d.acao) {
    case "perfil": {
      const nomes = String(d.nomes_citacao ?? "").split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
      if (!String(d.nome ?? "").trim()) throw new ErroAcesso("Informe o nome.");
      const dias = Number(d.dias_sem_movimentacao) || 90;
      executar(
        "UPDATE usuario SET nome = ?, nomes_citacao = ?, orcid = ?, lattes_id = ?, email = ?, area_qualis_ref = ?, dias_sem_movimentacao = ? WHERE id = ?",
        String(d.nome).trim(),
        JSON.stringify(nomes),
        normalizarOrcid(String(d.orcid ?? "")),
        String(d.lattes_id ?? "").trim() || null,
        String(d.email ?? "").trim() || null,
        String(d.area_qualis_ref ?? "").trim() || null,
        Math.max(7, Math.min(365, dias)),
        usuario.id,
      );
      return;
    }
    case "senha":
      await trocarSenha(usuario.id, String(d.atual ?? ""), String(d.nova ?? ""));
      (await cookies()).delete(COOKIE_SESSAO);
      return { sair: true };
    case "tipo":
      return { id: salvarTipo(ctx.donoId, { id: d.id ? numero(d.id) : undefined, nome: String(d.nome ?? ""), ativo: d.ativo !== false }) };
    case "subtipo":
      return {
        id: salvarSubtipo(ctx.donoId, { id: d.id ? numero(d.id) : undefined, tipo_id: numero(d.tipo_id), nome: String(d.nome ?? ""), ativo: d.ativo !== false }),
      };
    case "leitor":
      return { id: await criarLeitor(usuario.id, { cpf: String(d.cpf ?? ""), senha: String(d.senha ?? ""), nome: String(d.nome ?? ""), email: String(d.email ?? "") }) };
    case "leitor_ativo":
      executar("UPDATE usuario SET ativo = ? WHERE id = ? AND dono_id = ? AND perfil = 'leitor'", d.ativo ? 1 : 0, numero(d.id), usuario.id);
      if (!d.ativo) executar("UPDATE sessao SET encerrada = 1 WHERE usuario_id = ?", numero(d.id));
      return;
    case "backup":
      return { arquivo: fazerBackup() };
    case "excluir_tudo": {
      const u = um<{ senha_hash: string }>("SELECT senha_hash FROM usuario WHERE id = ?", usuario.id);
      if (!u || !(await verify(u.senha_hash, String(d.senha ?? "")).catch(() => false))) throw new ErroAcesso("Senha incorreta.");
      registrarAcesso(null, usuario.cpf_mascara, "exclusao_total");
      excluirTodosOsDados(usuario.id);
      (await cookies()).delete(COOKIE_SESSAO);
      return { sair: true };
    }
    default:
      return Response.json({ erro: "Ação inválida." }, { status: 400 });
  }
});
