"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";

type Acao = "importar" | "completar" | "pular";
interface Item {
  indice: number;
  origem: string;
  titulo: string;
  ano: number | null;
  onde: string | null;
  doi: string | null;
  situacao: "novo" | "existente" | "possivel_duplicata" | "repetido_no_arquivo";
  existente: { id: number; titulo: string } | null;
  acaoPadrao: Acao;
}
interface Previa {
  token: string;
  nome: string;
  atualizadoEm: string | null;
  itens: Item[];
}

const SITUACAO: Record<Item["situacao"], { rotulo: string; classe: string }> = {
  novo: { rotulo: "Novo", classe: "verde" },
  existente: { rotulo: "Já cadastrado", classe: "azul" },
  possivel_duplicata: { rotulo: "Possível duplicata", classe: "amarelo" },
  repetido_no_arquivo: { rotulo: "Repetido no Lattes", classe: "" },
};

export function ImportarLattes() {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [decisoes, setDecisoes] = useState<Record<number, Acao>>({});
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/lattes/previa", { method: "POST", body: new FormData(e.currentTarget) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível ler o arquivo.");
      setPrevia(j);
      setDecisoes(Object.fromEntries((j.itens as Item[]).map((i) => [i.indice, i.acaoPadrao])));
    } catch (er) {
      setMsg({ t: "erro", m: (er as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!previa) return;
    setOcupado(true);
    try {
      const r = await api<{ criados: number; completados: number; pulados: number; erros: string[] }>("/api/lattes/importar", "POST", {
        token: previa.token,
        decisoes,
      });
      setPrevia(null);
      setMsg({
        t: r.erros.length ? "atencao" : "ok",
        m: `Importação concluída: ${r.criados} publicação(ões) nova(s), ${r.completados} completada(s), ${r.pulados} ignorada(s).${r.erros.length ? ` Problemas: ${r.erros.join("; ")}` : ""} As taxas ficaram como "Ainda não sei": complete quando puder. Se algo não ficou bom, use "Desfazer" no histórico abaixo.`,
      });
      setTimeout(() => window.location.reload(), 6000);
    } catch (er) {
      setMsg({ t: "erro", m: (er as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  if (!previa)
    return (
      <form onSubmit={enviar} className="cartao">
        <div className="campo">
          <label htmlFor="arq-lattes">Arquivo do Lattes (.zip ou .xml)</label>
          <input id="arq-lattes" name="arquivo" type="file" accept=".zip,.xml" required />
        </div>
        {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
        <button type="submit" disabled={ocupado}>{ocupado ? "Lendo..." : "Ver prévia"}</button>
      </form>
    );

  const conta = (a: Acao) => Object.values(decisoes).filter((x) => x === a).length;
  return (
    <div className="cartao">
      <h2 style={{ marginTop: 0 }}>Prévia: {previa.nome}</h2>
      <p className="suave">
        {previa.itens.length} produção(ões) no currículo{previa.atualizadoEm ? `, atualizado em ${previa.atualizadoEm.split("-").reverse().join("/")}` : ""}.
        Nada foi gravado ainda. Confira a ação de cada item e clique em Confirmar.
      </p>
      <p>
        <strong>{conta("importar")}</strong> para importar · <strong>{conta("completar")}</strong> para completar (só campos vazios) ·{" "}
        <strong>{conta("pular")}</strong> para ignorar
      </p>
      <div className="tabela-rolagem">
        <table>
          <thead><tr><th>Situação</th><th>Produção</th><th>Tipo</th><th>Ano</th><th>Ação</th></tr></thead>
          <tbody>
            {previa.itens.map((i) => (
              <tr key={i.indice}>
                <td><span className={`selo ${SITUACAO[i.situacao].classe}`}>{SITUACAO[i.situacao].rotulo}</span></td>
                <td>
                  {i.titulo}
                  {i.onde && <div className="suave" style={{ fontSize: "0.85rem" }}>{i.onde}</div>}
                  {i.existente && (
                    <div style={{ fontSize: "0.85rem" }}>
                      No sistema: <a href={`/publicacoes/${i.existente.id}`} target="_blank" rel="noreferrer">{i.existente.titulo}</a>
                    </div>
                  )}
                </td>
                <td>{i.origem}</td>
                <td>{i.ano}</td>
                <td>
                  <select aria-label={`Ação para ${i.titulo}`} value={decisoes[i.indice]} onChange={(e) => setDecisoes({ ...decisoes, [i.indice]: e.target.value as Acao })}>
                    {i.situacao !== "existente" && <option value="importar">Importar como nova</option>}
                    {i.existente && <option value="completar">Completar a existente</option>}
                    <option value="pular">Ignorar</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
      <div className="acoes" style={{ marginTop: "0.75rem" }}>
        <button onClick={confirmar} disabled={ocupado}>{ocupado ? "Importando..." : "Confirmar importação"}</button>
        <button className="secundario" onClick={() => setPrevia(null)} disabled={ocupado}>Cancelar</button>
      </div>
    </div>
  );
}
