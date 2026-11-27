"use client";
import { useState } from "react";
import { api } from "./cliente";

interface Resultado {
  publicacoes: number;
  encontradas: number;
  totalOpenAlex: number;
  totalCrossref: number;
  h: number;
  novas: number;
  avisos: string[];
}

export function BotaoAtualizarCitacoes() {
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  async function atualizar() {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await api<Resultado>("/api/citacoes", "POST");
      setMsg({
        t: r.avisos.length && !r.encontradas ? "erro" : r.avisos.length ? "atencao" : "ok",
        m:
          `${r.encontradas} de ${r.publicacoes} publicação(ões) encontradas no OpenAlex. Citações: ${r.totalOpenAlex} (OpenAlex), ${r.totalCrossref} (Crossref). Índice h: ${r.h}.` +
          (r.novas ? ` ${r.novas} com citação nova.` : "") +
          (r.avisos.length ? ` Avisos: ${r.avisos.join("; ")}` : ""),
      });
      setTimeout(() => window.location.reload(), 3500);
    } catch (e) {
      setMsg({ t: "erro", m: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }
  return (
    <span>
      <button onClick={atualizar} disabled={ocupado}>{ocupado ? "Buscando citações (pode levar 1 a 2 minutos)..." : "Atualizar citações agora"}</button>
      {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
    </span>
  );
}

export function FormCitacaoManual({ publicacaoId, atual, fonte = "Google Acadêmico" }: { publicacaoId: number; atual: number | null; fonte?: string }) {
  const [total, setTotal] = useState(atual === null ? "" : String(atual));
  const [erro, setErro] = useState("");
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/citacoes/manual", "POST", { publicacao_id: publicacaoId, total, fonte });
      window.location.reload();
    } catch (er) {
      setErro((er as Error).message);
    }
  }
  return (
    <form onSubmit={salvar} className="acoes" style={{ flexWrap: "nowrap", maxWidth: 440 }}>
      <label htmlFor={`cit-${fonte}-${publicacaoId}`} style={{ whiteSpace: "nowrap", margin: 0, minWidth: 130 }}>{fonte}:</label>
      <input id={`cit-${fonte}-${publicacaoId}`} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} placeholder="nº de citações" style={{ width: 130 }} />
      <button type="submit" className="secundario pequeno">Salvar</button>
      {erro && <span className="aviso erro">{erro}</span>}
    </form>
  );
}

interface ResultadoGoogle {
  nome: string | null;
  artigos: number;
  vinculados: number;
  citacoes: number;
  h: number | null;
  foraDoSistema: { titulo: string; ano: number | null; citacoes: number }[];
}

/** Liga o perfil do Google Acadêmico e busca as citações de lá. */
export function GoogleAcademico({ link }: { link: string | null }) {
  const [perfil, setPerfil] = useState(link ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [mostrarArquivo, setMostrarArquivo] = useState(false);

  function mostrar(r: ResultadoGoogle) {
    setMsg({
      t: "ok",
      m:
        `Perfil lido${r.nome ? ` (${r.nome})` : ""}: ${r.artigos} trabalho(s), ${r.citacoes} citação(ões)${r.h !== null ? `, índice h ${r.h}` : ""}. ` +
        `${r.vinculados} ligado(s) às publicações do sistema.` +
        (r.foraDoSistema.length ? ` ${r.foraDoSistema.length} estão no Google mas não no sistema (lista abaixo).` : ""),
    });
    setTimeout(() => window.location.reload(), 3500);
  }
  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setMsg(null);
    try {
      mostrar(await api<ResultadoGoogle>("/api/citacoes/google", "POST", { perfil }));
    } catch (er) {
      const m = (er as Error).message;
      setMsg({ t: "erro", m });
      if (/robô|sem conexão|respondeu/.test(m)) setMostrarArquivo(true);
    } finally {
      setOcupado(false);
    }
  }
  async function enviarArquivo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch("/api/citacoes/google", { method: "POST", body: new FormData(e.currentTarget) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? `Erro ${r.status}`);
      mostrar(d as ResultadoGoogle);
    } catch (er) {
      setMsg({ t: "erro", m: (er as Error).message });
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div>
      <form onSubmit={buscar} className="acoes">
        <label htmlFor="perfil-google" style={{ margin: 0 }}>Link do seu perfil:</label>
        <input
          id="perfil-google"
          value={perfil}
          onChange={(e) => setPerfil(e.target.value)}
          placeholder="https://scholar.google.com.br/citations?user=..."
          style={{ flex: 1, minWidth: 260 }}
        />
        <button type="submit" disabled={ocupado || !perfil.trim()}>{ocupado ? "Lendo o perfil..." : "Buscar no Google Acadêmico"}</button>
      </form>
      <p className="ajuda suave">
        Depois de ligado, o sistema busca sozinho uma vez por mês.{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); setMostrarArquivo(!mostrarArquivo); }}>O Google pediu “não sou um robô”?</a>
      </p>
      {mostrarArquivo && (
        <form onSubmit={enviarArquivo} className="aviso info">
          <p style={{ marginTop: 0 }}>
            Abra o seu perfil no navegador, clique em <strong>MOSTRAR MAIS</strong> até aparecerem todos os trabalhos e aperte <strong>Ctrl+S</strong> (salvar página).
            Depois escolha o arquivo salvo aqui:
          </p>
          <div className="acoes">
            <input name="arquivo" type="file" accept=".html,.htm,.mhtml" required />
            <button type="submit" className="secundario" disabled={ocupado}>Enviar página</button>
          </div>
        </form>
      )}
      {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
    </div>
  );
}
