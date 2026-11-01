"use client";
import { useState } from "react";
import { api } from "./cliente";
import { STATUS } from "@/lib/constantes";

/** Formulário de mudança de status. Pede DOI e data ao marcar Publicado e prazo ao entrar Em revisão. */
export function MudarStatus({ id, atual, doiAtual, aoConcluir, inicial }: { id: number; atual: string; doiAtual?: string | null; aoConcluir?: () => void; inicial?: string }) {
  const [status, setStatus] = useState(inicial ?? atual);
  const [data, setData] = useState("");
  const [prazo, setPrazo] = useState("");
  const [doi, setDoi] = useState(doiAtual ?? "");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [enviando, setEnviando] = useState(false);
  const publicado = status === "Publicado" || status === "Apresentado";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await api<{ completados: string[] }>(`/api/publicacoes/${id}/status`, "POST", {
        status,
        data: publicado ? null : data || null,
        data_publicacao: publicado ? data || null : null,
        prazo_resposta: status === "Em revisão" ? prazo || null : undefined,
        doi: publicado && doi ? doi : null,
        observacao: obs || null,
      });
      if (r.completados?.length) setOk(`Status alterado. Completados pelo DOI: ${r.completados.join(", ")}.`);
      if (aoConcluir) aoConcluir();
      else window.location.reload();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <div className="grade grade-2">
        <div className="campo">
          <label htmlFor={`st-${id}`}>Novo status</label>
          <select id={`st-${id}`} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`dt-${id}`}>{publicado ? "Data de publicação" : "Data da mudança"}</label>
          <input id={`dt-${id}`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <div className="ajuda">Vazio = hoje</div>
        </div>
      </div>
      {status === "Em revisão" && (
        <div className="campo">
          <label htmlFor={`pr-${id}`}>Prazo para responder aos pareceres</label>
          <input id={`pr-${id}`} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          <div className="ajuda">Você recebe lembretes 7 e 2 dias antes.</div>
        </div>
      )}
      {publicado && (
        <div className="campo">
          <label htmlFor={`doi-${id}`}>DOI</label>
          <input id={`doi-${id}`} value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.xxxx/..." />
          <div className="ajuda">Com o DOI, o sistema completa sozinho volume, páginas e demais dados finais.</div>
        </div>
      )}
      <div className="campo">
        <label htmlFor={`obs-${id}`}>Observação (opcional)</label>
        <input id={`obs-${id}`} value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>
      {erro && <div className="aviso erro" role="alert">{erro}</div>}
      {ok && <div className="aviso ok">{ok}</div>}
      <button type="submit" disabled={enviando || status === atual}>{enviando ? "Salvando..." : "Mudar status"}</button>
    </form>
  );
}

export function Ressubmeter({ id }: { id: number }) {
  const [nome, setNome] = useState("");
  const [issn, setIssn] = useState("");
  const [data, setData] = useState("");
  const [erro, setErro] = useState("");
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/publicacoes/${id}/ressubmeter`, "POST", { veiculo: { nome, issn }, data: data || null });
      window.location.reload();
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  return (
    <form onSubmit={enviar}>
      <div className="grade grade-3">
        <div className="campo"><label htmlFor="rs-nome">Nova revista</label><input id="rs-nome" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
        <div className="campo"><label htmlFor="rs-issn">ISSN</label><input id="rs-issn" value={issn} onChange={(e) => setIssn(e.target.value)} /></div>
        <div className="campo"><label htmlFor="rs-data">Data da nova submissão</label><input id="rs-data" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}
      <button type="submit">Ressubmeter</button>
    </form>
  );
}
