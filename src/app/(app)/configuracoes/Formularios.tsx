"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";
import { CampoCpf, CampoSenha } from "@/componentes/CampoCpf";
import { AREAS_QUALIS_COMUNS } from "@/lib/constantes";

async function acao(dados: Record<string, unknown>) {
  const r = await api<{ sair?: boolean }>("/api/configuracoes", "POST", dados);
  if (r.sair) window.location.href = "/entrar";
  return r;
}

export function FormPerfil({ inicial }: { inicial: Record<string, string> }) {
  const [d, setD] = useState(inicial);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const c = (k: string, rotulo: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="campo">
      <label htmlFor={`p-${k}`}>{rotulo}</label>
      <input id={`p-${k}`} value={d[k] ?? ""} onChange={(e) => setD({ ...d, [k]: e.target.value })} {...extra} />
    </div>
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await acao({ acao: "perfil", ...d });
          setMsg({ t: "ok", m: "Dados salvos." });
        } catch (er) {
          setMsg({ t: "erro", m: (er as Error).message });
        }
      }}
    >
      <div className="grade grade-2">
        {c("nome", "Nome completo")}
        {c("email", "E-mail", { type: "email" })}
        {c("orcid", "ORCID")}
        {c("lattes_id", "ID Lattes")}
        <div className="campo">
          <label htmlFor="p-area">Área Qualis de referência</label>
          <input id="p-area" list="areas" value={d.area_qualis_ref ?? ""} onChange={(e) => setD({ ...d, area_qualis_ref: e.target.value })} />
          <datalist id="areas">{AREAS_QUALIS_COMUNS.map((a) => <option key={a} value={a} />)}</datalist>
          <div className="ajuda">Quando a revista tem vários Qualis, este é o que aparece nas listas e relatórios.</div>
        </div>
        {c("dias_sem_movimentacao", "Avisar item parado após (dias)", { inputMode: "numeric" })}
      </div>
      <div className="campo">
        <label htmlFor="p-cit">Nomes em citação (um por linha)</label>
        <textarea id="p-cit" value={d.nomes_citacao ?? ""} onChange={(e) => setD({ ...d, nomes_citacao: e.target.value })} />
      </div>
      {msg && <div className={`aviso ${msg.t}`}>{msg.m}</div>}
      <button type="submit">Salvar</button>
    </form>
  );
}

export function FormSenha() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await acao({ acao: "senha", atual, nova });
        } catch (er) {
          setErro((er as Error).message);
        }
      }}
    >
      <div className="grade grade-2">
        <div className="campo"><label htmlFor="s-atual">Senha atual</label><CampoSenha id="s-atual" valor={atual} mudar={setAtual} /></div>
        <div className="campo"><label htmlFor="s-nova">Nova senha</label><CampoSenha id="s-nova" valor={nova} mudar={setNova} novo /></div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}
      <button type="submit">Trocar senha</button> <span className="suave">Todas as sessões são encerradas depois da troca.</span>
    </form>
  );
}

export function EditorTipos({ tipos }: { tipos: { id: number; nome: string; ativo: number; subtipos: { id: number; nome: string; ativo: number }[] }[] }) {
  const [novoSub, setNovoSub] = useState<Record<number, string>>({});
  const [erro, setErro] = useState("");
  const salvar = async (d: Record<string, unknown>) => {
    try {
      await acao(d);
      window.location.reload();
    } catch (e) {
      setErro((e as Error).message);
    }
  };
  return (
    <div>
      {erro && <div className="aviso erro">{erro}</div>}
      {tipos.map((t) => (
        <details key={t.id} style={{ marginBottom: "0.5rem" }}>
          <summary>
            <strong>{t.nome}</strong> {!t.ativo && <span className="selo">inativo</span>} <small>({t.subtipos.length} subtipos)</small>
          </summary>
          <div style={{ padding: "0.5rem 0 0.5rem 1rem" }}>
            <div className="acoes" style={{ marginBottom: "0.5rem" }}>
              <button className="secundario pequeno" onClick={() => { const n = window.prompt("Novo nome do tipo:", t.nome); if (n) void salvar({ acao: "tipo", id: t.id, nome: n, ativo: !!t.ativo }); }}>Renomear tipo</button>
              <button className="secundario pequeno" onClick={() => void salvar({ acao: "tipo", id: t.id, nome: t.nome, ativo: !t.ativo })}>{t.ativo ? "Desativar tipo" : "Reativar tipo"}</button>
            </div>
            <ul className="lista-itens">
              {t.subtipos.map((s) => (
                <li key={s.id} className="acoes" style={{ justifyContent: "space-between", padding: "0.3rem 0" }}>
                  <span style={s.ativo ? undefined : { textDecoration: "line-through", color: "#666" }}>{s.nome}</span>
                  <span className="acoes">
                    <button className="secundario pequeno" onClick={() => { const n = window.prompt("Novo nome:", s.nome); if (n) void salvar({ acao: "subtipo", id: s.id, tipo_id: t.id, nome: n, ativo: !!s.ativo }); }}>Renomear</button>
                    <button className="secundario pequeno" onClick={() => void salvar({ acao: "subtipo", id: s.id, tipo_id: t.id, nome: s.nome, ativo: !s.ativo })}>{s.ativo ? "Desativar" : "Reativar"}</button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="acoes" style={{ flexWrap: "nowrap", marginTop: "0.4rem" }}>
              <input aria-label={`Novo subtipo de ${t.nome}`} placeholder="Novo subtipo" value={novoSub[t.id] ?? ""} onChange={(e) => setNovoSub({ ...novoSub, [t.id]: e.target.value })} />
              <button className="pequeno" onClick={() => novoSub[t.id] && void salvar({ acao: "subtipo", tipo_id: t.id, nome: novoSub[t.id] })}>Adicionar</button>
            </div>
          </div>
        </details>
      ))}
      <button className="secundario pequeno" onClick={() => { const n = window.prompt("Nome do novo tipo de publicação:"); if (n) void salvar({ acao: "tipo", nome: n }); }}>+ Novo tipo</button>
    </div>
  );
}

export function FormLeitor() {
  const [d, setD] = useState({ nome: "", cpf: "", senha: "", email: "" });
  const [erro, setErro] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await acao({ acao: "leitor", ...d });
          window.location.reload();
        } catch (er) {
          setErro((er as Error).message);
        }
      }}
    >
      <div className="grade grade-2">
        <div className="campo"><label htmlFor="l-nome">Nome</label><input id="l-nome" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} required /></div>
        <div className="campo"><label htmlFor="l-email">E-mail</label><input id="l-email" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></div>
        <div className="campo"><label htmlFor="l-cpf">CPF do leitor</label><CampoCpf id="l-cpf" valor={d.cpf} mudar={(v) => setD({ ...d, cpf: v })} /></div>
        <div className="campo"><label htmlFor="l-senha">Senha inicial (6 a 8 números)</label><CampoSenha id="l-senha" valor={d.senha} mudar={(v) => setD({ ...d, senha: v })} novo /></div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}
      <button type="submit">Criar leitor</button>
    </form>
  );
}

export function ExcluirTudo() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm("Isto apaga TODOS os seus dados deste computador (publicações, custos, leitores, histórico). Os backups em arquivo continuam na pasta de backups. Continuar?")) return;
        try {
          await acao({ acao: "excluir_tudo", senha });
        } catch (er) {
          setErro((er as Error).message);
        }
      }}
    >
      <div className="campo" style={{ maxWidth: 300 }}>
        <label htmlFor="x-senha">Confirme com sua senha</label>
        <CampoSenha id="x-senha" valor={senha} mudar={setSenha} />
      </div>
      {erro && <div className="aviso erro">{erro}</div>}
      <button type="submit" className="perigo">Excluir todos os meus dados</button>
    </form>
  );
}
