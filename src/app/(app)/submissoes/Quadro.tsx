"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";
import { MudarStatus } from "@/componentes/MudarStatus";
import { dataBr, diasEntre, hojeIso } from "@/lib/texto";

export interface CartaoSub {
  id: number;
  titulo: string;
  veiculo: string | null;
  status: string;
  data_submissao: string | null;
  dias_parado: number | null;
  prazo_resposta: string | null;
  rodada_revisao: number | null;
  doi: string | null;
}

const COLUNAS = ["Em elaboração", "Submetido", "Em avaliação", "Em revisão", "Aceito"];
const DESTINOS = ["Publicado", "Recusado", "Retirado"];
const PEDE_DADOS = ["Em revisão", "Publicado", "Apresentado"];

export function Quadro({ cartoes, limiteDias }: { cartoes: CartaoSub[]; limiteDias: number }) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [modal, setModal] = useState<{ c: CartaoSub; destino: string } | null>(null);
  const [erro, setErro] = useState("");

  async function mover(c: CartaoSub, destino: string) {
    if (destino === c.status) return;
    if (PEDE_DADOS.includes(destino)) return setModal({ c, destino });
    try {
      await api(`/api/publicacoes/${c.id}/status`, "POST", { status: destino });
      window.location.reload();
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  const soltar = (destino: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setSobre(null);
    const c = cartoes.find((x) => x.id === arrastando);
    if (c) void mover(c, destino);
  };
  const alvo = (destino: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setSobre(destino);
    },
    onDragLeave: () => setSobre(null),
    onDrop: soltar(destino),
  });
  const hoje = hojeIso();

  return (
    <>
      {erro && <div className="aviso erro">{erro}</div>}
      <div className="kanban">
        {COLUNAS.map((col) => {
          const itens = cartoes.filter((c) => c.status === col);
          return (
            <section key={col} className={`coluna-kanban ${sobre === col ? "sobre" : ""}`} {...alvo(col)} aria-label={col}>
              <h2>{col} <span className="selo">{itens.length}</span></h2>
              {itens.map((c) => {
                const faltam = c.prazo_resposta ? diasEntre(hoje, c.prazo_resposta) : null;
                return (
                  <article key={c.id} className="cartao-kanban" draggable onDragStart={() => setArrastando(c.id)} onDragEnd={() => setArrastando(null)}>
                    <a href={`/publicacoes/${c.id}`} className="item-titulo">{c.titulo}</a>
                    <div className="meta">
                      {c.veiculo && <span>{c.veiculo}</span>}
                      {c.data_submissao && <span>Submetido {dataBr(c.data_submissao)}</span>}
                      {c.dias_parado !== null && (
                        <span className={c.dias_parado >= limiteDias && c.status !== "Em elaboração" ? "selo amarelo" : ""}>
                          {c.dias_parado} dia(s) sem movimentação
                        </span>
                      )}
                      {c.rodada_revisao && <span>{c.rodada_revisao}ª rodada</span>}
                      {faltam !== null && faltam >= 0 && (
                        <span className={`selo ${faltam <= 7 ? "vermelho" : "azul"}`}>Prazo {dataBr(c.prazo_resposta)} ({faltam} dias)</span>
                      )}
                    </div>
                    <label className="pular-para-conteudo" htmlFor={`mover-${c.id}`}>Mover para</label>
                    <select
                      id={`mover-${c.id}`}
                      aria-label={`Mover "${c.titulo}" para`}
                      value=""
                      onChange={(e) => e.target.value && void mover(c, e.target.value)}
                      style={{ marginTop: "0.4rem", fontSize: "0.82rem", padding: "0.2rem" }}
                    >
                      <option value="">Mover para...</option>
                      {[...COLUNAS, ...DESTINOS].filter((s) => s !== c.status).map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </article>
                );
              })}
            </section>
          );
        })}
        <section className="coluna-kanban" style={{ background: "#e5f3ea" }} aria-label="Concluir">
          <h2>Concluir</h2>
          {DESTINOS.map((d) => (
            <div key={d} className={`cartao-kanban ${sobre === d ? "sobre" : ""}`} {...alvo(d)} style={{ textAlign: "center", cursor: "default", outline: sobre === d ? "3px dashed #1d4f91" : undefined }}>
              Solte aqui: <strong>{d}</strong>
            </div>
          ))}
          <p className="ajuda suave">Publicado leva o item para Publicados com todo o histórico. Recusado e Retirado vão para Encerrados.</p>
        </section>
      </div>
      {modal && (
        <div className="fundo-modal" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="topo">
              <h2 style={{ margin: 0 }}>{modal.c.titulo}</h2>
              <button className="secundario pequeno" onClick={() => setModal(null)} aria-label="Fechar">✕</button>
            </div>
            <MudarStatus id={modal.c.id} atual={modal.c.status} inicial={modal.destino} doiAtual={modal.c.doi} />
          </div>
        </div>
      )}
    </>
  );
}
