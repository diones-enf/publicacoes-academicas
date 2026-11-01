"use client";
import { useState } from "react";
import { api } from "./cliente";
import { MOEDAS, PAGADORES, TIPOS_CUSTO } from "@/lib/constantes";

export interface LancamentoEdicao {
  id?: number;
  tipo: string;
  descricao: string;
  valor: string;
  moeda: string;
  competencia: string;
  data_pagamento: string;
  data_vencimento: string;
  pagador: string;
  parte_autor: string;
}

export const lancamentoVazio = (): LancamentoEdicao => ({
  tipo: "Inscrição em evento", descricao: "", valor: "", moeda: "BRL", competencia: "", data_pagamento: "", data_vencimento: "", pagador: "Próprio", parte_autor: "",
});

export function FormLancamento({ publicacaoId, inicial, aoFechar }: { publicacaoId?: number | null; inicial?: LancamentoEdicao; aoFechar?: () => void }) {
  const [l, setL] = useState<LancamentoEdicao>(inicial ?? lancamentoVazio());
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const m = (k: keyof LancamentoEdicao) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setL({ ...l, [k]: e.target.value });
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const num = (v: string) => (v === "" ? null : Number(v.replace(",", ".")));
    const corpo = {
      publicacao_id: publicacaoId ?? null,
      tipo: l.tipo,
      descricao: l.descricao,
      valor: num(l.valor),
      moeda: l.moeda,
      competencia: l.competencia || null,
      data_pagamento: l.data_pagamento || null,
      data_vencimento: l.data_vencimento || null,
      pagador: l.pagador,
      parte_autor: num(l.parte_autor),
    };
    try {
      if (l.id) await api(`/api/custos/${l.id}`, "PUT", corpo);
      else await api("/api/custos", "POST", corpo);
      window.location.reload();
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }
  return (
    <form onSubmit={enviar}>
      <div className="grade grade-3">
        <div className="campo">
          <label htmlFor="l-tipo">Tipo</label>
          <select id="l-tipo" value={l.tipo} onChange={m("tipo")}>{TIPOS_CUSTO.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div className="campo">
          <label htmlFor="l-desc">Descrição {l.tipo === "Outros" ? "(obrigatória)" : "(opcional)"}</label>
          <input id="l-desc" value={l.descricao} onChange={m("descricao")} required={l.tipo === "Outros"} />
        </div>
        <div className="campo">
          <label htmlFor="l-valor">Valor total</label>
          <input id="l-valor" inputMode="decimal" value={l.valor} onChange={m("valor")} required placeholder="0,00" />
          <div className="ajuda">0 = gratuito</div>
        </div>
        <div className="campo">
          <label htmlFor="l-moeda">Moeda</label>
          <select id="l-moeda" value={l.moeda} onChange={m("moeda")}>{MOEDAS.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div className="campo">
          <label htmlFor="l-pag">Data do pagamento</label>
          <input id="l-pag" type="date" value={l.data_pagamento} onChange={m("data_pagamento")} />
          <div className="ajuda">Vazio = pendente</div>
        </div>
        <div className="campo">
          <label htmlFor="l-comp">Competência (mês a que se refere)</label>
          <input id="l-comp" type="month" value={l.competencia} onChange={m("competencia")} />
          <div className="ajuda">Vazio = mês do pagamento</div>
        </div>
        {!l.data_pagamento && (
          <div className="campo">
            <label htmlFor="l-venc">Previsão de pagamento</label>
            <input id="l-venc" type="date" value={l.data_vencimento} onChange={m("data_vencimento")} />
          </div>
        )}
        <div className="campo">
          <label htmlFor="l-pagador">Pagador</label>
          <select id="l-pagador" value={l.pagador} onChange={m("pagador")}>{PAGADORES.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div className="campo">
          <label htmlFor="l-parte">Sua parte (rateio)</label>
          <input id="l-parte" inputMode="decimal" value={l.parte_autor} onChange={m("parte_autor")} placeholder="valor inteiro" />
        </div>
      </div>
      {erro && <div className="aviso erro" role="alert">{erro}</div>}
      <div className="acoes">
        <button type="submit" disabled={enviando}>{l.id ? "Salvar lançamento" : "Adicionar lançamento"}</button>
        {aoFechar && <button type="button" className="secundario" onClick={aoFechar}>Cancelar</button>}
      </div>
    </form>
  );
}
