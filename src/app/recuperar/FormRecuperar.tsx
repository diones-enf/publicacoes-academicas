"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";
import { CampoCpf, CampoSenha } from "@/componentes/CampoCpf";

export function FormRecuperar({ comEmail }: { comEmail: boolean }) {
  const [modo, setModo] = useState<"codigo" | "email">("codigo");
  const [cpf, setCpf] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: string; texto: string } | null>(null);
  const [novoCodigo, setNovoCodigo] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      if (modo === "codigo") {
        const r = await api<{ novoCodigo: string }>("/api/recuperar", "POST", { modo: "codigo", cpf, codigo, senha });
        setNovoCodigo(r.novoCodigo);
      } else if (!emailEnviado) {
        await api("/api/recuperar", "POST", { modo: "email-enviar", cpf });
        setEmailEnviado(true);
        setMsg({ tipo: "info", texto: "Se o CPF tiver e-mail cadastrado, um código de 6 dígitos foi enviado. Ele vale por 15 minutos." });
      } else {
        await api("/api/recuperar", "POST", { modo: "email-confirmar", cpf, codigo, senha });
        setMsg({ tipo: "ok", texto: "Senha alterada. Você já pode entrar." });
      }
    } catch (e) {
      setMsg({ tipo: "erro", texto: (e as Error).message });
    }
  }

  if (novoCodigo)
    return (
      <div>
        <div className="aviso ok">Senha alterada. Todas as sessões abertas foram encerradas.</div>
        <p>Seu código de recuperação antigo deixou de valer. Anote o novo:</p>
        <p style={{ fontSize: "1.5rem", fontFamily: "monospace" }}>{novoCodigo}</p>
        <a className="botao" href="/entrar">Entrar</a>
      </div>
    );

  return (
    <form onSubmit={enviar}>
      {comEmail && (
        <div className="acoes" role="radiogroup" style={{ marginBottom: "0.75rem" }}>
          <label className="inline"><input type="radio" checked={modo === "codigo"} onChange={() => setModo("codigo")} /> Tenho o código de recuperação</label>
          <label className="inline"><input type="radio" checked={modo === "email"} onChange={() => setModo("email")} /> Receber código por e-mail</label>
        </div>
      )}
      <div className="campo">
        <label htmlFor="cpf">CPF</label>
        <CampoCpf valor={cpf} mudar={setCpf} />
      </div>
      {(modo === "codigo" || emailEnviado) && (
        <>
          <div className="campo">
            <label htmlFor="codigo">{modo === "codigo" ? "Código de recuperação (mostrado no cadastro)" : "Código recebido por e-mail"}</label>
            <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} required autoComplete="one-time-code" />
          </div>
          <div className="campo">
            <label htmlFor="senha">Nova senha (6 a 8 números)</label>
            <CampoSenha valor={senha} mudar={setSenha} novo />
          </div>
        </>
      )}
      {msg && <div className={`aviso ${msg.tipo}`} role="alert">{msg.texto}</div>}
      <button type="submit">{modo === "email" && !emailEnviado ? "Enviar código" : "Trocar a senha"}</button>
    </form>
  );
}
