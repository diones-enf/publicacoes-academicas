import { exigirUsuario } from "@/lib/sessao";
import { leitoresDe, nomesCitacaoDe } from "@/lib/auth";
import { listarTipos } from "@/lib/tipos";
import { listarBackups, pastaBackups } from "@/lib/backup";
import { metaLer, todos, caminhoBanco } from "@/lib/db";
import { emailConfigurado } from "@/lib/email";
import { dataBr } from "@/lib/texto";
import { BotaoAcao } from "@/componentes/Acoes";
import { AtualizarSistema } from "@/componentes/AtualizarSistema";
import { EditorTipos, ExcluirTudo, FormLeitor, FormPerfil, FormSenha } from "./Formularios";

export default async function Configuracoes() {
  const u = await exigirUsuario("autor");
  const leitores = leitoresDe(u.id);
  const backups = listarBackups().slice(0, 5);
  const ultimoBackup = metaLer("ultimo_backup");
  const acessos = todos<{ evento: string; detalhe: string | null; em: string }>(
    "SELECT evento, detalhe, em FROM log_acesso WHERE usuario_id = ? ORDER BY id DESC LIMIT 15",
    u.id,
  );
  return (
    <>
      <h1>Configurações</h1>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Atualização do sistema</h2>
        <AtualizarSistema />
      </section>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Seus dados</h2>
        <p className="suave">CPF: {u.cpf_mascara} (o número completo não fica gravado).</p>
        <FormPerfil
          inicial={{
            nome: u.nome,
            email: u.email ?? "",
            orcid: u.orcid ?? "",
            lattes_id: u.lattes_id ?? "",
            area_qualis_ref: u.area_qualis_ref ?? "",
            dias_sem_movimentacao: String(u.dias_sem_movimentacao),
            nomes_citacao: nomesCitacaoDe(u).join("\n"),
          }}
        />
      </section>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Senha e sessões</h2>
        <FormSenha />
        <hr style={{ margin: "1rem 0", border: 0, borderTop: "1px solid var(--borda)" }} />
        <p>A sessão expira sozinha após 30 minutos sem uso.</p>
        <BotaoAcao url="/api/sessao" metodo="PATCH" rotulo="Encerrar todas as sessões (inclusive esta)" classe="secundario" depois="/entrar" />
      </section>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Tipos e subtipos de publicação</h2>
        <p className="suave">O tipo define quais campos aparecem no formulário e em qual relatório o item entra.</p>
        <EditorTipos tipos={listarTipos(u.id, true)} />
      </section>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Leitores convidados</h2>
        <p className="suave">Ex.: orientador ou secretaria. Só veem os relatórios (nunca o seu CPF) e não podem alterar nada.</p>
        {leitores.length > 0 && (
          <ul className="lista-itens">
            {leitores.map((l) => (
              <li key={l.id} className="acoes" style={{ justifyContent: "space-between" }}>
                <span>{l.nome} <small>({l.cpf_mascara}{l.email ? `, ${l.email}` : ""})</small> {!l.ativo && <span className="selo">desativado</span>}</span>
                <BotaoAcao url="/api/configuracoes" corpo={{ acao: "leitor_ativo", id: l.id, ativo: !l.ativo }} rotulo={l.ativo ? "Desativar" : "Reativar"} />
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary>Convidar leitor</summary>
          <div style={{ marginTop: "0.5rem" }}><FormLeitor /></div>
        </details>
      </section>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Backup</h2>
        <p>
          O sistema copia o banco inteiro todo dia, na primeira vez que é aberto, e guarda os últimos 30 dias.
          {ultimoBackup ? ` Último backup: ${new Date(ultimoBackup).toLocaleString("pt-BR")}.` : ""}
        </p>
        <p className="suave">Pasta: <code>{pastaBackups()}</code><br />Banco: <code>{caminhoBanco()}</code></p>
        {backups.length > 0 && <ul>{backups.map((b) => <li key={b.arquivo}>{b.arquivo} ({Math.round(b.tamanho / 1024)} KB)</li>)}</ul>}
        <div className="acoes">
          <BotaoAcao url="/api/configuracoes" corpo={{ acao: "backup" }} rotulo="Fazer backup agora" classe="secundario" />
          <a className="botao secundario" href="/api/exportar?formato=json">Exportar tudo (JSON)</a>
          <a className="botao secundario" href="/api/exportar?formato=xlsx">Exportar tudo (XLSX)</a>
        </div>
        <p className="ajuda suave">Dica: para ter uma cópia fora do notebook, configure PASTA_BACKUP_EXTRA no arquivo .env apontando para uma pasta do OneDrive ou Google Drive.</p>
      </section>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>E-mail</h2>
        <p>
          {emailConfigurado()
            ? "O envio de e-mail está configurado: lembretes e recuperação de senha também chegam por e-mail."
            : "O envio de e-mail não está configurado. Os lembretes aparecem no painel e a recuperação de senha usa o código de recuperação. Veja o README para configurar (opcional)."}
        </p>
      </section>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Privacidade (LGPD)</h2>
        <p>Consentimento registrado em {u.consentimento_em ? dataBr(u.consentimento_em.slice(0, 10)) : "—"}. Você pode exportar (acima) ou excluir todos os dados.</p>
        <details>
          <summary>Últimos acessos</summary>
          <ul>{acessos.map((a, i) => <li key={i}>{dataBr(a.em.slice(0, 10))} {a.em.slice(11, 16)} (UTC) — {a.evento}{a.detalhe ? ` (${a.detalhe})` : ""}</li>)}</ul>
        </details>
        <details style={{ marginTop: "0.5rem" }}>
          <summary>Excluir todos os meus dados</summary>
          <div style={{ marginTop: "0.5rem" }}><ExcluirTudo /></div>
        </details>
      </section>
    </>
  );
}
