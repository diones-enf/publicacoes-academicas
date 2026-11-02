"use client";
import { useMemo, useState } from "react";
import { api, ErroApi } from "@/componentes/cliente";
import { CAMPOS_POR_TIPO, IDIOMAS, MOEDAS, PAGADORES, PAPEIS_AUTOR, STATUS, STATUS_SUBMISSOES } from "@/lib/constantes";
import { localizarAutorPrincipal, papelPadrao } from "@/lib/autoria";
import { numeroBr } from "@/lib/texto";
import { formParaApi, type FormPub, type TaxaForm, type TipoOpcao, type VeiculoOpcao } from "./modelo";

interface Duplicata {
  publicacao_id: number;
  titulo: string;
  ano: number | null;
  motivo: string;
  similaridade: number;
}

interface Props {
  inicial: FormPub;
  tipos: TipoOpcao[];
  veiculos: VeiculoOpcao[];
  principal: { nome: string; orcid: string | null; nomesCitacao: string[] };
  id?: number;
  subtipoSugerido?: string | null;
}

function Fonte({ f }: { f?: string }) {
  return f ? <span className="fonte" title={`Preenchido automaticamente pelo ${f}`}>{f}</span> : null;
}

export function FormularioPublicacao({ inicial, tipos, veiculos, principal, id, subtipoSugerido }: Props) {
  const [f, setF] = useState<FormPub>(inicial);
  const [erro, setErro] = useState("");
  const [duplicatas, setDuplicatas] = useState<Duplicata[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  const tipo = tipos.find((t) => String(t.id) === f.tipo_id);
  const chave = tipo?.chave ?? "artigo";
  const campos = CAMPOS_POR_TIPO[chave] ?? [];
  const tem = (c: string) => campos.includes(c);
  const emSubmissao = (STATUS_SUBMISSOES as string[]).includes(f.status);

  const set = <K extends keyof FormPub>(k: K, v: FormPub[K]) => {
    setF((atual) => {
      const origem = { ...atual.origem };
      delete origem[k as string]; // editado à mão: deixa de mostrar a fonte
      return { ...atual, [k]: v, origem };
    });
  };
  const campo = (k: keyof FormPub, rotulo: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, ajuda?: string) => (
    <div className="campo">
      <label htmlFor={`c-${k}`}>
        {rotulo}
        <Fonte f={f.origem[k as string]} />
      </label>
      <input id={`c-${k}`} value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} {...extra} />
      {ajuda && <div className="ajuda">{ajuda}</div>}
    </div>
  );

  // Autor principal reconhecido automaticamente pelos nomes em citação/ORCID
  const idxAuto = useMemo(() => localizarAutorPrincipal(f.autores, principal), [f.autores, principal]);
  const idxPrincipal = f.principal_idx >= 0 ? f.principal_idx : idxAuto;
  const papelAuto = idxPrincipal >= 0 ? papelPadrao(idxPrincipal, f.autores.filter((a) => a.nome.trim()).length) : "";

  function mudarAutor(i: number, campo: "nome" | "orcid" | "correspondente", v: string | boolean) {
    setF((a) => ({ ...a, autores: a.autores.map((x, j) => (j === i ? { ...x, [campo]: v } : x)) }));
  }
  function moverAutor(i: number, d: number) {
    setF((a) => {
      const l = [...a.autores];
      const j = i + d;
      if (j < 0 || j >= l.length) return a;
      [l[i], l[j]] = [l[j], l[i]];
      let p = a.principal_idx;
      if (p === i) p = j;
      else if (p === j) p = i;
      return { ...a, autores: l, principal_idx: p };
    });
  }
  function removerAutor(i: number) {
    setF((a) => ({
      ...a,
      autores: a.autores.filter((_, j) => j !== i),
      principal_idx: a.principal_idx === i ? -1 : a.principal_idx > i ? a.principal_idx - 1 : a.principal_idx,
    }));
  }

  function escolherVeiculo(nome: string) {
    const v = veiculos.find((x) => x.nome === nome);
    setF((a) => ({
      ...a,
      veiculo_nome: nome,
      veiculo_issn: v ? (v.issn ?? "") : a.veiculo_issn,
      veiculo_eissn: v ? (v.eissn ?? "") : a.veiculo_eissn,
      veiculo_editora: v ? (v.editora ?? "") : a.veiculo_editora,
    }));
  }

  async function salvar(ignorarDuplicidade = false) {
    setErro("");
    setSalvando(true);
    try {
      const corpo = { ...formParaApi(f, chave, campos), ignorarDuplicidade };
      const r = id
        ? await api<{ id: number }>(`/api/publicacoes/${id}`, "PUT", corpo)
        : await api<{ id: number }>("/api/publicacoes", "POST", corpo);
      window.location.href = `/publicacoes/${r.id}`;
    } catch (e) {
      setSalvando(false);
      if (e instanceof ErroApi && e.status === 409) {
        setDuplicatas((e.dados.duplicatas as Duplicata[]) ?? []);
        setErro(e.message);
      } else setErro((e as Error).message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const taxa = (k: "taxa_submissao" | "taxa_publicacao", rotulo: string) => {
    const t = f[k];
    const mudar = (c: keyof TaxaForm, v: string | boolean) => setF((a) => ({ ...a, [k]: { ...a[k], [c]: v } }));
    return (
      <fieldset>
        <legend>{rotulo} (obrigatório)</legend>
        <label className="inline" style={{ marginBottom: "0.5rem" }}>
          <input type="checkbox" checked={t.nao_sei} onChange={(e) => mudar("nao_sei", e.target.checked)} /> Ainda não sei
        </label>
        {!t.nao_sei && (
          <div className="grade grade-4">
            <div className="campo">
              <label htmlFor={`${k}-valor`}>Valor total</label>
              <input id={`${k}-valor`} inputMode="decimal" placeholder="0,00" value={t.valor} onChange={(e) => mudar("valor", e.target.value)} required />
              <div className="ajuda">0 = gratuito</div>
            </div>
            <div className="campo">
              <label htmlFor={`${k}-moeda`}>Moeda</label>
              <select id={`${k}-moeda`} value={t.moeda} onChange={(e) => mudar("moeda", e.target.value)}>
                {MOEDAS.map((m) => <option key={m}>{m}</option>)}
              </select>
              {t.moeda !== "BRL" && <div className="ajuda">Convertido pela PTAX do dia do pagamento.</div>}
            </div>
            <div className="campo">
              <label htmlFor={`${k}-pag`}>Pago em</label>
              <input id={`${k}-pag`} type="date" value={t.data_pagamento} onChange={(e) => mudar("data_pagamento", e.target.value)} />
              <div className="ajuda">Vazio = ainda não pago</div>
            </div>
            {!t.data_pagamento && (numeroBr(t.valor) ?? 0) > 0 && (
              <div className="campo">
                <label htmlFor={`${k}-venc`}>Previsão de pagamento</label>
                <input id={`${k}-venc`} type="date" value={t.data_vencimento} onChange={(e) => mudar("data_vencimento", e.target.value)} />
              </div>
            )}
            <div className="campo">
              <label htmlFor={`${k}-pagador`}>Pagador</label>
              <select id={`${k}-pagador`} value={t.pagador} onChange={(e) => mudar("pagador", e.target.value)}>
                {PAGADORES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor={`${k}-parte`}>Sua parte (rateio)</label>
              <input id={`${k}-parte`} inputMode="decimal" placeholder="valor inteiro" value={t.parte_autor} onChange={(e) => mudar("parte_autor", e.target.value)} />
              <div className="ajuda">Se dividiu com coautores</div>
            </div>
          </div>
        )}
      </fieldset>
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar(false);
      }}
    >
      {erro && (
        <div className="aviso erro" role="alert">
          {erro}
          {duplicatas && duplicatas.length > 0 && (
            <>
              <ul>
                {duplicatas.map((d) => (
                  <li key={d.publicacao_id}>
                    <a href={`/publicacoes/${d.publicacao_id}`} target="_blank" rel="noreferrer">{d.titulo}</a> {d.ano ? `(${d.ano})` : ""} —{" "}
                    {d.motivo === "doi" ? "mesmo DOI" : d.motivo === "isbn" ? "mesmo ISBN e título" : `${Math.round(d.similaridade * 100)}% parecido`}
                  </li>
                ))}
              </ul>
              {duplicatas.every((d) => d.motivo !== "doi") && (
                <button type="button" className="secundario" onClick={() => void salvar(true)}>
                  Não é duplicata, salvar mesmo assim
                </button>
              )}
            </>
          )}
        </div>
      )}
      {Object.keys(f.origem).length > 0 && (
        <div className="aviso info">
          Campos marcados com o nome de uma fonte foram preenchidos automaticamente. Confira e corrija o que precisar antes de salvar.
        </div>
      )}

      <fieldset>
        <legend>Publicação</legend>
        <div className="grade grade-3">
          <div className="campo">
            <label htmlFor="c-tipo">Tipo</label>
            <select id="c-tipo" value={f.tipo_id} onChange={(e) => setF({ ...f, tipo_id: e.target.value, subtipo_id: "" })} required>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="c-subtipo">Subtipo</label>
            <select id="c-subtipo" value={f.subtipo_id} onChange={(e) => set("subtipo_id", e.target.value)}>
              <option value="">— escolha —</option>
              {tipo?.subtipos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            {subtipoSugerido && (
              <div className="ajuda">Sugestão pelo título/resumo: <strong>{subtipoSugerido}</strong>. Confirme.</div>
            )}
          </div>
          <div className="campo">
            <label htmlFor="c-status">Status</label>
            <select id="c-status" value={f.status} onChange={(e) => set("status", e.target.value)}>
              {STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="c-titulo">Título{tem("livro_titulo") ? " do capítulo" : ""}<Fonte f={f.origem.titulo} /></label>
          <input id="c-titulo" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} required />
        </div>
        <div className="grade grade-3">
          {campo("doi", "DOI", { placeholder: "10.xxxx/..." })}
          <div className="campo">
            <label htmlFor="c-idioma">Idioma<Fonte f={f.origem.idioma} /></label>
            <select id="c-idioma" value={f.idioma} onChange={(e) => set("idioma", e.target.value)}>
              <option value="">—</option>
              {[...new Set([...IDIOMAS, f.idioma].filter(Boolean))].map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          {campo("area_tematica", "Área temática")}
        </div>
      </fieldset>

      {(tem("veiculo") || tem("issn") || chave === "livro") && chave !== "capitulo" && (
        <fieldset>
          <legend>{chave === "jornal" ? "Veículo" : chave === "livro" ? "Editora" : chave === "anais" ? "Anais" : "Revista"}</legend>
          {(tem("veiculo")) && (
            <div className="grade grade-2">
              <div className="campo">
                <label htmlFor="c-veiculo">{chave === "jornal" ? "Jornal ou revista" : "Revista"}<Fonte f={f.origem.veiculo_nome} /></label>
                <input id="c-veiculo" list="lista-veiculos" value={f.veiculo_nome} onChange={(e) => escolherVeiculo(e.target.value)} />
                <datalist id="lista-veiculos">
                  {veiculos.map((v) => <option key={v.id} value={v.nome} />)}
                </datalist>
                <div className="ajuda">Escolha uma já cadastrada ou digite uma nova.</div>
              </div>
              {campo("veiculo_editora", "Editora da revista")}
            </div>
          )}
          {tem("issn") && (
            <div className="grade grade-2">
              {campo("veiculo_issn", "ISSN impresso", { placeholder: "0000-0000" })}
              {campo("veiculo_eissn", "e-ISSN", { placeholder: "0000-0000" })}
            </div>
          )}
          {chave === "livro" && (
            <div className="grade grade-3">
              {campo("editora", "Editora")}
              {campo("cidade", "Cidade")}
              {campo("edicao", "Edição")}
            </div>
          )}
        </fieldset>
      )}

      {chave === "capitulo" && (
        <fieldset>
          <legend>Livro</legend>
          {campo("livro_titulo", "Título do livro")}
          <div className="grade grade-3">
            {campo("organizadores", "Organizadores", {}, "Separe por ponto e vírgula")}
            {campo("editora", "Editora")}
            {campo("cidade", "Cidade")}
          </div>
        </fieldset>
      )}

      {tem("evento") && (
        <fieldset>
          <legend>Evento</legend>
          <div className="grade grade-2">
            {campo("evento_nome", "Nome do evento")}
            {campo("evento_edicao", "Edição", { placeholder: "ex.: 25ª" })}
          </div>
          <div className="grade grade-3">
            {campo("evento_cidade", "Cidade")}
            {campo("evento_data", "Data", { type: "date" })}
            {campo("evento_instituicao", "Instituição promotora")}
          </div>
          {(tem("modalidade") || tem("premiacao")) && (
            <div className="grade grade-2">
              {tem("modalidade") && campo("modalidade", "Modalidade", { list: "lista-modalidades" })}
              {tem("premiacao") && campo("premiacao", "Premiação", { placeholder: "ex.: Menção honrosa" })}
              <datalist id="lista-modalidades">
                {["Oral", "Pôster/banner", "Mesa-redonda", "Palestra"].map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>Detalhes</legend>
        <div className="grade grade-4">
          {(tem("volume") || chave === "artigo") && campo("volume", "Volume")}
          {(tem("numero") || chave === "artigo") && campo("numero", "Número")}
          {tem("paginas") && campo("paginas", chave === "livro" ? "Nº de páginas" : "Páginas ou e-locator")}
          {tem("isbn") && campo("isbn", "ISBN")}
          {tem("instituicao") && campo("instituicao", "Instituição")}
          {tem("registro") && campo("registro", "Registro")}
          {campo("link", "Link")}
        </div>
        <div className="grade grade-4">
          {campo("data_submissao", "Data de submissão", { type: "date" })}
          {campo("data_aceite", "Data de aceite", { type: "date" })}
          {campo("data_publicacao", chave === "apresentacao" ? "Data da apresentação" : "Data de publicação", { type: "date" })}
          {campo("ano", "Ano", { inputMode: "numeric", maxLength: 4 })}
        </div>
        {campo("palavras_chave", "Palavras-chave", {}, "Separe por ponto e vírgula")}
        <div className="campo">
          <label htmlFor="c-resumo">Resumo<Fonte f={f.origem.resumo} /></label>
          <textarea id="c-resumo" value={f.resumo} onChange={(e) => set("resumo", e.target.value)} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Autoria<Fonte f={f.origem.autores} /></legend>
        <p className="ajuda suave">
          Na ordem em que aparecem na publicação. O sistema reconhece você pelos seus nomes em citação e pelo ORCID (destacado em verde).
        </p>
        {f.autores.map((a, i) => (
          <div key={i} className={`autor-linha ${i === idxPrincipal ? "principal" : ""}`}>
            <input aria-label={`Autor ${i + 1}`} value={a.nome} placeholder={`${i + 1}º autor`} onChange={(e) => mudarAutor(i, "nome", e.target.value)} />
            <input aria-label={`ORCID do autor ${i + 1}`} value={a.orcid} placeholder="ORCID" onChange={(e) => mudarAutor(i, "orcid", e.target.value)} />
            <label className="inline">
              <input type="radio" name="principal" checked={i === idxPrincipal} onChange={() => setF({ ...f, principal_idx: i })} /> Sou eu
            </label>
            <label className="inline">
              <input type="checkbox" checked={a.correspondente} onChange={(e) => mudarAutor(i, "correspondente", e.target.checked)} /> Corresp.
            </label>
            <span className="acoes">
              <button type="button" className="secundario pequeno" onClick={() => moverAutor(i, -1)} aria-label="Subir">↑</button>
              <button type="button" className="secundario pequeno" onClick={() => moverAutor(i, 1)} aria-label="Descer">↓</button>
              <button type="button" className="secundario pequeno" onClick={() => removerAutor(i)} aria-label="Remover">✕</button>
            </span>
          </div>
        ))}
        <div className="acoes" style={{ marginTop: "0.5rem" }}>
          <button type="button" className="secundario pequeno" onClick={() => setF({ ...f, autores: [...f.autores, { nome: "", orcid: "", correspondente: false }] })}>
            + Adicionar autor
          </button>
          {f.autores.length === 0 && (
            <button type="button" className="secundario pequeno" onClick={() => setF({ ...f, autores: [{ nome: principal.nomesCitacao[0] ?? principal.nome, orcid: principal.orcid ?? "", correspondente: false }] })}>
              + Adicionar eu mesmo
            </button>
          )}
        </div>
        {f.autores.length > 0 && idxPrincipal < 0 && (
          <div className="aviso atencao">Você não foi reconhecido na lista de autores. Marque &quot;Sou eu&quot; na linha certa.</div>
        )}
        <div className="campo" style={{ marginTop: "0.75rem", maxWidth: 360 }}>
          <label htmlFor="c-papel">Seu papel</label>
          <select id="c-papel" value={f.papel_autor} onChange={(e) => set("papel_autor", e.target.value)}>
            <option value="">Automático{papelAuto ? ` (${papelAuto})` : ""}</option>
            {PAPEIS_AUTOR.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </fieldset>

      {emSubmissao && (
        <fieldset>
          <legend>Submissão em andamento</legend>
          <div className="grade grade-3">
            {campo("id_submissao", "Nº/ID da submissão")}
            {campo("link_sistema", "Link do sistema da revista", { placeholder: "OJS, ScholarOne..." })}
            {campo("editor_responsavel", "Editor responsável")}
            {campo("rodada_revisao", "Rodada de revisão", { inputMode: "numeric" })}
            {campo("prazo_resposta", "Prazo para responder aos pareceres", { type: "date" }, "Gera lembretes 7 e 2 dias antes")}
          </div>
        </fieldset>
      )}

      {taxa("taxa_submissao", "Taxa de submissão")}
      {taxa("taxa_publicacao", "Taxa de publicação (APC)")}

      <div className="campo">
        <label htmlFor="c-obs">Observações</label>
        <textarea id="c-obs" value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
      </div>
      <div className="acoes">
        <button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
        <a href={id ? `/publicacoes/${id}` : "/"} className="botao secundario">Cancelar</a>
      </div>
    </form>
  );
}
