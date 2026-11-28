"use client";
// Lê um e-mail, declaração ou carta da revista e preenche a publicação.
// Passo 1: arquivo ou texto colado. Passo 2: conferir o que foi achado e aplicar.
import { useState } from "react";
import { CATEGORIAS_ANEXO, STATUS } from "@/lib/constantes";
import type { LeituraDocumento } from "@/lib/leitorDocumento";

export interface OpcaoPublicacao {
  id: number;
  titulo: string;
  status: string;
}

interface Props {
  publicacoes?: OpcaoPublicacao[];
  publicacaoFixa?: OpcaoPublicacao;
  anexoId?: number;
  inicial?: { nome: string; leitura: LeituraDocumento };
}

const br = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "");

async function enviar<T>(url: string, form: FormData): Promise<T> {
  const r = await fetch(url, { method: "POST", body: form });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) window.location.href = "/entrar?expirou=1";
  if (!r.ok) {
    const dup = (d as { duplicatas?: { titulo: string }[] }).duplicatas;
    throw new Error(((d as { erro?: string }).erro ?? `Erro ${r.status}`) + (dup?.length ? ` Já existe: "${dup[0].titulo}". Escolha essa publicação na lista em vez de "Nova".` : ""));
  }
  return d as T;
}

export function LerDocumento({ publicacoes = [], publicacaoFixa, anexoId, inicial }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [lido, setLido] = useState(inicial ?? null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<{ id: number; criada: boolean; alterados: string[] } | null>(null);
  const [f, setF] = useState<Record<string, string>>(() => (inicial ? campos(inicial.leitura) : {}));

  function campos(l: LeituraDocumento): Record<string, string> {
    return {
      publicacao_id: publicacaoFixa ? String(publicacaoFixa.id) : l.publicacao ? String(l.publicacao.id) : "",
      titulo: l.titulo?.valor ?? "",
      revista: l.revista?.valor ?? "",
      issn: l.issn?.valor ?? "",
      status: l.status?.valor ?? "",
      data: l.data?.valor ?? "",
      prazo_resposta: l.prazo?.valor ?? "",
      rodada: l.rodada ? String(l.rodada.valor) : "",
      id_submissao: l.idSubmissao?.valor ?? "",
      link_sistema: l.link?.valor ?? "",
      editor_responsavel: l.editor?.valor ?? "",
      doi: l.doi?.valor ?? "",
      categoria: l.categoria,
    };
  }
  const muda = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function ler(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      const form = new FormData();
      if (arquivo) form.append("arquivo", arquivo);
      else form.append("texto", texto);
      const r = await enviar<{ nome: string; leitura: LeituraDocumento }>("/api/documentos/ler", form);
      setLido(r);
      setF(campos(r.leitura));
    } catch (er) {
      setErro((er as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function aplicar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      const form = new FormData();
      form.append("dados", JSON.stringify({ ...f, publicacao_id: f.publicacao_id ? Number(f.publicacao_id) : null, rodada: f.rodada ? Number(f.rodada) : null }));
      if (arquivo && !anexoId) form.append("arquivo", arquivo);
      if (anexoId) form.append("anexo_id", String(anexoId));
      setFeito(await enviar("/api/documentos/aplicar", form));
    } catch (er) {
      setErro((er as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (feito)
    return (
      <div className="aviso ok" role="status">
        {feito.criada ? "Publicação cadastrada" : "Publicação atualizada"}
        {feito.alterados.length ? ` (${feito.alterados.length} alteração(ões))` : " (nada mudou)"}.{" "}
        <a href={`/publicacoes/${feito.id}`}>Abrir a publicação</a> ·{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>Fechar e atualizar a tela</a>
      </div>
    );

  if (!lido)
    return (
      <form onSubmit={ler}>
        <p className="suave" style={{ marginTop: 0 }}>
          Envie o e-mail da revista, a declaração ou a carta (submissão, avaliação, correções, aceite, recusa, publicação).
          O sistema lê e mostra o que achou para você conferir antes de gravar.
        </p>
        <div className="campo">
          <label htmlFor="doc-arquivo">Arquivo (PDF, Word, e-mail .eml)</label>
          <input id="doc-arquivo" type="file" accept=".pdf,.docx,.eml,.txt,.html,.htm,.mht,.mhtml" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          <div className="ajuda">E-mail no Gmail: abra a mensagem → ⋮ → <strong>Fazer download da mensagem</strong> (.eml) ou <strong>Imprimir</strong> → Salvar como PDF.</div>
        </div>
        <div className="campo">
          <label htmlFor="doc-texto">…ou cole aqui o texto do e-mail</label>
          <textarea id="doc-texto" rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!!arquivo} placeholder="Abra o e-mail, aperte Ctrl+A e Ctrl+C, e cole aqui (Ctrl+V)." />
        </div>
        {erro && <div className="aviso erro" role="alert">{erro}</div>}
        <button type="submit" disabled={ocupado || (!arquivo && texto.trim().length < 20)}>{ocupado ? "Lendo..." : "Ler documento"}</button>
      </form>
    );

  const l = lido.leitura;
  const pista = (a: { trecho: string } | null | undefined) => (a ? <div className="ajuda suave" title={a.trecho}>Achado: “{a.trecho.slice(0, 110)}”</div> : <div className="ajuda suave">Não achado no documento</div>);
  const nova = !f.publicacao_id;
  return (
    <form onSubmit={aplicar}>
      <div className={`aviso ${l.status ? "info" : "atencao"}`}>
        <strong>{lido.nome}:</strong> {l.resumo} Confira e corrija o que precisar antes de aplicar.
      </div>
      {!publicacaoFixa && (
        <div className="campo">
          <label htmlFor="doc-pub">Qual publicação?</label>
          <select id="doc-pub" value={f.publicacao_id} onChange={muda("publicacao_id")}>
            <option value="">+ Cadastrar como nova publicação</option>
            {publicacoes.map((p) => (
              <option key={p.id} value={p.id}>{p.titulo.slice(0, 110)} ({p.status})</option>
            ))}
          </select>
          {l.publicacao && <div className="ajuda">Reconhecida pelo {l.publicacao.motivo}.</div>}
        </div>
      )}
      {nova && (
        <div className="campo">
          <label htmlFor="doc-titulo">Título</label>
          <input id="doc-titulo" value={f.titulo} onChange={muda("titulo")} required />
          {pista(l.titulo)}
        </div>
      )}
      <div className="grade grade-2">
        <div className="campo">
          <label htmlFor="doc-status">O que aconteceu (status)</label>
          <select id="doc-status" value={f.status} onChange={muda("status")}>
            <option value="">(não mudar o status)</option>
            {STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
          {pista(l.status)}
        </div>
        <div className="campo">
          <label htmlFor="doc-data">Data {f.status ? `(${f.status.toLowerCase()})` : ""}</label>
          <input id="doc-data" type="date" value={f.data} onChange={muda("data")} />
          {l.data ? pista(l.data) : <div className="ajuda suave">Não achada: vazio = hoje</div>}
        </div>
        <div className="campo">
          <label htmlFor="doc-revista">Revista</label>
          <input id="doc-revista" value={f.revista} onChange={muda("revista")} />
          {pista(l.revista)}
        </div>
        <div className="campo">
          <label htmlFor="doc-id">Nº do manuscrito / ID da submissão</label>
          <input id="doc-id" value={f.id_submissao} onChange={muda("id_submissao")} />
          {pista(l.idSubmissao)}
        </div>
        {(f.status === "Em revisão" || l.prazo) && (
          <div className="campo">
            <label htmlFor="doc-prazo">Prazo para responder</label>
            <input id="doc-prazo" type="date" value={f.prazo_resposta} onChange={muda("prazo_resposta")} />
            {pista(l.prazo)}
          </div>
        )}
        {f.status === "Em revisão" && (
          <div className="campo">
            <label htmlFor="doc-rodada">Rodada de revisão</label>
            <input id="doc-rodada" inputMode="numeric" value={f.rodada} onChange={muda("rodada")} placeholder="vazio = próxima" />
          </div>
        )}
        <div className="campo">
          <label htmlFor="doc-link">Link do sistema da revista</label>
          <input id="doc-link" value={f.link_sistema} onChange={muda("link_sistema")} />
        </div>
        <div className="campo">
          <label htmlFor="doc-editor">Editor(a) responsável</label>
          <input id="doc-editor" value={f.editor_responsavel} onChange={muda("editor_responsavel")} />
        </div>
        {(f.status === "Publicado" || f.status === "Aceito" || f.doi) && (
          <div className="campo">
            <label htmlFor="doc-doi">DOI</label>
            <input id="doc-doi" value={f.doi} onChange={muda("doi")} />
          </div>
        )}
        {(arquivo || anexoId) && (
          <div className="campo">
            <label htmlFor="doc-cat">Guardar o arquivo como</label>
            <select id="doc-cat" value={f.categoria} onChange={muda("categoria")}>
              {CATEGORIAS_ANEXO.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>
      {f.status === "Publicado" && <p className="ajuda">Data = data de publicação. Com o DOI, o sistema completa volume e páginas depois.</p>}
      {erro && <div className="aviso erro" role="alert">{erro}</div>}
      <div className="acoes">
        <button type="submit" disabled={ocupado}>{ocupado ? "Gravando..." : nova ? "Cadastrar publicação" : "Aplicar na publicação"}</button>
        {!inicial && <button type="button" className="secundario" onClick={() => { setLido(null); setErro(""); }}>Ler outro documento</button>}
      </div>
      {br(f.data) && f.status && <p className="ajuda suave">Vai registrar: {f.status} em {br(f.data)}.</p>}
    </form>
  );
}
