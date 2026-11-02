"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";
import { FormularioPublicacao } from "@/componentes/formulario/FormularioPublicacao";
import { formDeMetadados, formVazio, type FormPub, type TipoOpcao, type VeiculoOpcao } from "@/componentes/formulario/modelo";
import type { Metadados } from "@/lib/conectores/tipos";

type Modo = "doi" | "autor" | "titulo" | "isbn";
interface Preenchimento {
  dados: Metadados;
  origem: Record<string, string>;
  fontes: string[];
  avisos: string[];
  subtipo_sugerido: string | null;
  duplicatas: { publicacao_id: number; titulo: string; motivo: string }[];
}
interface Resultado {
  fonte: string;
  fontes: string[];
  doi: string | null;
  titulo: string;
  revista: string | null;
  ano: number | null;
  autores: string[];
  cadastrado_id: number | null;
}

const MODOS: { chave: Modo; rotulo: string; dica: string }[] = [
  { chave: "doi", rotulo: "Por DOI", dica: "Cole o DOI em qualquer formato: 10.xxxx/..., doi.org/... ou o link completo." },
  { chave: "autor", rotulo: "Por autor ou ORCID", dica: "Lista as publicações encontradas no ORCID, OpenAlex e Crossref que ainda não estão no sistema." },
  { chave: "titulo", rotulo: "Por título", dica: "Para itens sem DOI à mão." },
  { chave: "isbn", rotulo: "Por ISBN", dica: "Para livros e capítulos." },
];

export function NovaPublicacao(props: {
  tipos: TipoOpcao[];
  veiculos: VeiculoOpcao[];
  principal: { nome: string; orcid: string | null; nomesCitacao: string[] };
  nomeSugerido: string;
}) {
  const [modo, setModo] = useState<Modo>("doi");
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [duplicado, setDuplicado] = useState<Preenchimento["duplicatas"] | null>(null);
  const [form, setForm] = useState<{ f: FormPub; sugestao: string | null; fontes: string[] } | null>(null);

  async function buscar(modoBusca: Modo, termo: string) {
    setErro("");
    setAvisos([]);
    setResultados(null);
    setDuplicado(null);
    setBuscando(true);
    try {
      const r = await api<Preenchimento & { resultados?: Resultado[]; erro?: string }>(
        `/api/busca?modo=${modoBusca}&q=${encodeURIComponent(termo)}`,
      );
      setAvisos(r.avisos ?? []);
      if (modoBusca === "doi" || modoBusca === "isbn") {
        if (r.erro) return setErro(r.erro);
        if (modoBusca === "doi" && r.duplicatas.some((d) => d.motivo === "doi")) return setDuplicado(r.duplicatas);
        setForm({ f: formDeMetadados(r.dados, r.origem, props.tipos, r.subtipo_sugerido), sugestao: r.subtipo_sugerido, fontes: r.fontes });
      } else {
        setResultados(r.resultados ?? []);
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  function usarResultado(r: Resultado) {
    if (r.doi) {
      setModo("doi");
      setQ(r.doi);
      void buscar("doi", r.doi);
      return;
    }
    const f = formVazio(String(props.tipos[0]?.id ?? ""));
    f.titulo = r.titulo;
    f.veiculo_nome = r.revista ?? "";
    f.ano = r.ano ? String(r.ano) : "";
    f.autores = r.autores.map((nome) => ({ nome, orcid: "", correspondente: false }));
    f.status = r.ano ? "Publicado" : "Em elaboração";
    f.origem = { titulo: r.fonte, veiculo_nome: r.fonte, ano: r.fonte, autores: r.fonte };
    setForm({ f, sugestao: null, fontes: r.fontes });
  }

  if (form)
    return (
      <>
        <div className="acoes nao-imprimir" style={{ marginBottom: "0.75rem" }}>
          <button className="secundario pequeno" onClick={() => setForm(null)}>← Voltar à busca</button>
          {form.fontes.length > 0 && <span className="suave">Dados encontrados em: {form.fontes.join(", ")}</span>}
        </div>
        <div className="cartao">
          <FormularioPublicacao inicial={form.f} tipos={props.tipos} veiculos={props.veiculos} principal={props.principal} subtipoSugerido={form.sugestao} />
        </div>
      </>
    );

  const dica = MODOS.find((m) => m.chave === modo)!.dica;
  // Só mostra o que ainda falta cadastrar
  const pendentes = (resultados ?? []).filter((r) => !r.cadastrado_id);
  const jaCadastrados = (resultados ?? []).length - pendentes.length;
  return (
    <>
      <div className="cartao">
        <div className="abas" role="tablist">
          {MODOS.map((m) => (
            <button
              key={m.chave}
              role="tab"
              aria-selected={modo === m.chave}
              onClick={() => {
                setModo(m.chave);
                setResultados(null);
                setErro("");
                if (m.chave === "autor" && !q) setQ(props.nomeSugerido);
              }}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void buscar(modo, q);
          }}
        >
          <label htmlFor="busca">{MODOS.find((m) => m.chave === modo)!.rotulo}</label>
          <div className="acoes" style={{ flexWrap: "nowrap" }}>
            <input id="busca" value={q} onChange={(e) => setQ(e.target.value)} autoFocus required />
            <button type="submit" disabled={buscando}>{buscando ? "Buscando..." : "Buscar"}</button>
          </div>
          <div className="ajuda suave">{dica}</div>
        </form>
        {erro && <div className="aviso erro" role="alert">{erro}</div>}
        {avisos.length > 0 && <div className="aviso atencao">Algumas fontes não responderam: {avisos.join("; ")}</div>}
        {duplicado && (
          <div className="aviso atencao" role="alert">
            Este DOI já está cadastrado:{" "}
            {duplicado.map((d) => <a key={d.publicacao_id} href={`/publicacoes/${d.publicacao_id}`}>{d.titulo}</a>)}. Abra o item existente
            para editar.
          </div>
        )}
        <p style={{ marginTop: "1rem" }}>
          <button className="link" onClick={() => setForm({ f: formVazio(String(props.tipos[0]?.id ?? "")), sugestao: null, fontes: [] })}>
            Preencher em branco, sem busca
          </button>
        </p>
      </div>

      {resultados && (
        <div className="cartao">
          <h2 style={{ marginTop: 0 }}>{pendentes.length} publicação(ões) ainda não cadastrada(s)</h2>
          {jaCadastrados > 0 && (
            <p className="suave">{jaCadastrados} resultado(s) já estão no sistema e foram ocultados.</p>
          )}
          {pendentes.length === 0 && (
            <p>{jaCadastrados > 0 ? "Tudo o que foi encontrado já está cadastrado." : "Nada encontrado."} <button className="link" onClick={() => setForm({ f: formVazio(String(props.tipos[0]?.id ?? "")), sugestao: null, fontes: [] })}>Preencher em branco</button></p>
          )}
          <ul className="lista-itens">
            {pendentes.map((r, i) => (
              <li key={i}>
                <div className="item-titulo">{r.titulo}</div>
                <div className="meta">
                  {r.revista && <span>{r.revista}</span>}
                  {r.ano && <span>{r.ano}</span>}
                  {r.doi && <span>DOI {r.doi}</span>}
                  <span>{r.fontes.join(", ")}</span>
                  {r.autores.length > 0 && <span>{r.autores.slice(0, 4).join("; ")}{r.autores.length > 4 ? " et al." : ""}</span>}
                </div>
                <div className="acoes" style={{ marginTop: "0.3rem" }}>
                  {r.cadastrado_id ? (
                    <>
                      <span className="selo verde">Já cadastrado</span>
                      <a href={`/publicacoes/${r.cadastrado_id}`}>Abrir</a>
                    </>
                  ) : (
                    <button className="pequeno" onClick={() => usarResultado(r)}>Cadastrar este</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
