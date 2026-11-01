"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";
import { CampoCpf, CampoSenha } from "@/componentes/CampoCpf";

export function FormEntrar() {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await api("/api/sessao", "POST", { cpf, senha });
      window.location.href = "/";
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }
  return (
    <form onSubmit={enviar}>
      <div className="campo">
        <label htmlFor="cpf">CPF</label>
        <CampoCpf valor={cpf} mudar={setCpf} />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha (6 a 8 números)</label>
        <CampoSenha valor={senha} mudar={setSenha} />
      </div>
      {erro && <div className="aviso erro" role="alert">{erro}</div>}
      <div className="acoes">
        <button type="submit" disabled={enviando}>{enviando ? "Entrando..." : "Entrar"}</button>
        <a href="/recuperar">Esqueci a senha</a>
      </div>
    </form>
  );
}
