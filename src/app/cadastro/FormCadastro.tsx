"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";
import { CampoCpf, CampoSenha } from "@/componentes/CampoCpf";
import { nomeEmCitacao } from "@/lib/texto";

export function FormCadastro() {
  const [d, setD] = useState({ cpf: "", senha: "", senha2: "", nome: "", nomesCitacao: "", orcid: "", lattesId: "", email: "", dataNascimento: "", consentimento: false });
  const [erro, setErro] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const mudar = (k: keyof typeof d) => (v: string | boolean) => setD({ ...d, [k]: v });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (d.senha !== d.senha2) return setErro("As duas senhas não são iguais.");
    setEnviando(true);
    try {
      const r = await api<{ codigoRecuperacao: string }>("/api/cadastro", "POST", d);
      setCodigo(r.codigoRecuperacao);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (codigo)
    return (
      <div>
        <div className="aviso ok">Conta criada.</div>
        <h2>Guarde seu código de recuperação</h2>
        <p>Se você esquecer a senha, este código permite criar uma nova. Ele aparece <strong>só agora</strong>. Anote em papel ou num gerenciador de senhas.</p>
        <p style={{ fontSize: "1.6rem", fontFamily: "monospace", letterSpacing: "0.1em" }}>{codigo}</p>
        <a className="botao" href="/">Já anotei, ir para o sistema</a>
      </div>
    );

  return (
    <form onSubmit={enviar}>
      <div className="grade grade-2">
        <div className="campo">
          <label htmlFor="nome">Nome completo</label>
          <input id="nome" value={d.nome} onChange={(e) => mudar("nome")(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="nasc">Data de nascimento</label>
          <input id="nasc" type="date" value={d.dataNascimento} onChange={(e) => mudar("dataNascimento")(e.target.value)} required />
          <div className="ajuda">Usada só para impedir que a senha seja a sua data de nascimento.</div>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="citacao">Nomes em citação (um por linha)</label>
        <textarea
          id="citacao"
          value={d.nomesCitacao}
          placeholder={d.nome ? nomeEmCitacao(d.nome) : "ROSA, D. R."}
          onChange={(e) => mudar("nomesCitacao")(e.target.value)}
        />
        <div className="ajuda">Todas as formas como seu nome aparece nos artigos (ex.: ROSA, D. R. / ROSA, D. / Rosa DR). É assim que o sistema reconhece você na lista de autores.</div>
      </div>
      <div className="grade grade-3">
        <div className="campo">
          <label htmlFor="orcid">ORCID</label>
          <input id="orcid" placeholder="0000-0000-0000-0000" value={d.orcid} onChange={(e) => mudar("orcid")(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="lattes">ID Lattes</label>
          <input id="lattes" inputMode="numeric" value={d.lattesId} onChange={(e) => mudar("lattesId")(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={d.email} onChange={(e) => mudar("email")(e.target.value)} />
        </div>
      </div>
      <div className="grade grade-3">
        <div className="campo">
          <label htmlFor="cpf">CPF</label>
          <CampoCpf valor={d.cpf} mudar={mudar("cpf")} />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha (6 a 8 números)</label>
          <CampoSenha valor={d.senha} mudar={mudar("senha")} novo />
        </div>
        <div className="campo">
          <label htmlFor="senha2">Repita a senha</label>
          <CampoSenha id="senha2" valor={d.senha2} mudar={mudar("senha2")} novo />
        </div>
      </div>
      <p className="ajuda suave">Não use sequências (123456), números repetidos (000000) nem sua data de nascimento.</p>
      <fieldset>
        <legend>Termo de consentimento (LGPD)</legend>
        <p style={{ fontSize: "0.9rem" }}>
          Este sistema guarda, apenas neste computador, seus dados de identificação (nome, ORCID, Lattes, e-mail, data de nascimento e
          CPF em forma cifrada, nunca o número em si) e os dados da sua produção acadêmica, com a finalidade exclusiva de organizar
          publicações, custos e relatórios. Nada é enviado a terceiros; as buscas em bases públicas (Crossref, OpenAlex, ORCID, DataCite,
          Banco Central) enviam só o DOI, ISBN, título ou nome pesquisado. Você pode exportar ou excluir todos os seus dados a qualquer
          momento em Configurações. Os acessos ficam registrados.
        </p>
        <label className="inline">
          <input type="checkbox" checked={d.consentimento} onChange={(e) => mudar("consentimento")(e.target.checked)} required /> Li e concordo.
        </label>
      </fieldset>
      {erro && <div className="aviso erro" role="alert">{erro}</div>}
      <button type="submit" disabled={enviando}>{enviando ? "Criando..." : "Criar conta"}</button>
    </form>
  );
}
