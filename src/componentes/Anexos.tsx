"use client";
// Anexos de uma publicação: enviar (botão ou arrastar), abrir, baixar, trocar categoria e excluir.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./cliente";
import { CATEGORIAS_ANEXO, LIMITE_ANEXO_MB } from "@/lib/constantes";
import type { LeituraDocumento } from "@/lib/leitorDocumento";
import { LerDocumento } from "./LerDocumento";

interface Anexo {
  id: number;
  categoria: string;
  nome_original: string;
  tamanho: number;
  status_na_hora: string | null;
  observacao: string | null;
  criado_em: string;
}

function tamanho(b: number) {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
/** O banco grava em UTC; mostra no horário do computador. */
function dataHora(iso: string) {
  const d = new Date(iso.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Envia arquivos para uma publicação. Usado também ao mudar o status. */
interface Leitura {
  anexoId: number;
  nome: string;
  leitura: LeituraDocumento;
}

export async function enviarAnexos(publicacaoId: number, arquivos: File[], categoria: string, observacao = ""): Promise<Leitura[]> {
  const grandes = arquivos.filter((f) => f.size > LIMITE_ANEXO_MB * 1024 * 1024);
  if (grandes.length) throw new Error(`Arquivo acima de ${LIMITE_ANEXO_MB} MB: ${grandes.map((f) => f.name).join(", ")}`);
  const form = new FormData();
  for (const f of arquivos) form.append("arquivo", f);
  form.append("categoria", categoria);
  form.append("observacao", observacao);
  const r = await fetch(`/api/publicacoes/${publicacaoId}/anexos`, { method: "POST", body: form });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) window.location.href = "/entrar?expirou=1";
  if (!r.ok) throw new Error((d as { erro?: string }).erro ?? `Erro ${r.status}`);
  return (d as { leituras?: Leitura[] }).leituras ?? [];
}

export function Anexos({ publicacaoId, aoMudar }: { publicacaoId: number; categoriaInicial?: string; aoMudar?: (n: number) => void }) {
  const [lista, setLista] = useState<Anexo[] | null>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [categoria, setCategoria] = useState("auto");
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [conferir, setConferir] = useState<Leitura | null>(null);
  const [obs, setObs] = useState("");
  const [sobre, setSobre] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const l = await api<Anexo[]>(`/api/publicacoes/${publicacaoId}/anexos`);
    setLista(l);
    aoMudar?.(l.length);
  }, [publicacaoId, aoMudar]);
  useEffect(() => {
    carregar().catch((e) => setMsg({ t: "erro", m: (e as Error).message }));
  }, [carregar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivos.length) return setMsg({ t: "erro", m: "Escolha ou arraste pelo menos um arquivo." });
    setOcupado(true);
    setMsg(null);
    try {
      const l = await enviarAnexos(publicacaoId, arquivos, categoria, obs);
      setLeituras(l);
      setMsg({ t: "ok", m: `${arquivos.length} arquivo(s) anexado(s).` + (l.length ? " Li o documento: confira abaixo." : "") });
      setArquivos([]);
      setObs("");
      if (entrada.current) entrada.current.value = "";
      await carregar();
    } catch (er) {
      setMsg({ t: "erro", m: (er as Error).message });
    } finally {
      setOcupado(false);
    }
  }
  async function trocarCategoria(a: Anexo, cat: string) {
    await api(`/api/anexos/${a.id}`, "PATCH", { categoria: cat });
    await carregar();
  }
  async function excluir(a: Anexo) {
    if (!confirm(`Excluir o anexo "${a.nome_original}"? O arquivo será apagado.`)) return;
    try {
      await api(`/api/anexos/${a.id}`, "DELETE");
      await carregar();
    } catch (er) {
      setMsg({ t: "erro", m: (er as Error).message });
    }
  }

  return (
    <div>
      <form onSubmit={enviar}>
        <div
          className="zona-arquivos"
          onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
          onDragLeave={() => setSobre(false)}
          onDrop={(e) => { e.preventDefault(); setSobre(false); setArquivos([...arquivos, ...Array.from(e.dataTransfer.files)]); }}
          style={{ border: `2px dashed ${sobre ? "var(--primaria)" : "var(--borda)"}`, background: sobre ? "var(--primaria-clara)" : undefined, borderRadius: "var(--raio)", padding: "0.8rem", textAlign: "center" }}
        >
          <label htmlFor={`anexo-${publicacaoId}`} style={{ cursor: "pointer", margin: 0 }}>
            📎 <strong>Clique para escolher</strong> ou arraste os arquivos para cá
          </label>
          <input
            ref={entrada}
            id={`anexo-${publicacaoId}`}
            type="file"
            multiple
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
            style={{ display: "block", margin: "0.4rem auto 0" }}
          />
          {arquivos.length > 0 && <div className="ajuda">{arquivos.map((f) => `${f.name} (${tamanho(f.size)})`).join(" · ")}</div>}
          <div className="ajuda suave">PDF, Word, imagens, planilhas... até {LIMITE_ANEXO_MB} MB cada.</div>
        </div>
        <div className="grade grade-2" style={{ marginTop: "0.5rem" }}>
          <div className="campo">
            <label htmlFor={`cat-${publicacaoId}`}>Tipo de documento</label>
            <select id={`cat-${publicacaoId}`} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="auto">Descobrir sozinho (lê o arquivo)</option>
              {CATEGORIAS_ANEXO.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor={`obs-anexo-${publicacaoId}`}>Observação (opcional)</label>
            <input id={`obs-anexo-${publicacaoId}`} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: 2ª rodada, parecer do revisor 1" />
          </div>
        </div>
        <button type="submit" disabled={ocupado || !arquivos.length}>{ocupado ? "Enviando..." : "Anexar"}</button>
      </form>
      {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
      {conferir ? (
        <div className="cartao" style={{ marginTop: "0.6rem" }}>
          <LerDocumento publicacaoFixa={{ id: publicacaoId, titulo: "", status: "" }} anexoId={conferir.anexoId} inicial={conferir} />
        </div>
      ) : (
        leituras.map((l) => (
          <div key={l.anexoId} className="aviso info">
            📄 <strong>{l.nome}:</strong> {l.leitura.resumo}{" "}
            <button type="button" className="pequeno" onClick={() => setConferir(l)}>Conferir e preencher a publicação</button>
          </div>
        ))
      )}
      <div className="tabela-rolagem" style={{ marginTop: "0.8rem" }}>
        {lista === null ? (
          <p className="suave">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="suave">Nenhum documento anexado ainda.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Arquivo</th><th>Tipo de documento</th><th>Quando</th><th className="num">Tamanho</th><th></th></tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td>
                    <a href={`/api/anexos/${a.id}`} target="_blank" rel="noopener">{a.nome_original}</a>
                    {a.observacao && <div className="ajuda suave">{a.observacao}</div>}
                  </td>
                  <td>
                    <select aria-label={`Tipo de documento de ${a.nome_original}`} value={a.categoria} onChange={(e) => void trocarCategoria(a, e.target.value)} style={{ fontSize: "0.85rem", padding: "0.2rem" }}>
                      {CATEGORIAS_ANEXO.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{dataHora(a.criado_em)}{a.status_na_hora && <div className="ajuda suave">{a.status_na_hora}</div>}</td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>{tamanho(a.tamanho)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a className="botao secundario pequeno" href={`/api/anexos/${a.id}?baixar=1`}>Baixar</a>{" "}
                    <button type="button" className="perigo pequeno" onClick={() => void excluir(a)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
