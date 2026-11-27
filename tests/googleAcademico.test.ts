import { describe, expect, it } from "vitest";
import { artigo, novoAmbiente } from "./apoio";
import { criarPublicacao } from "@/lib/publicacoes";
import { idDoPerfil, lerPerfilGoogle, paginaBloqueada } from "@/lib/conectores/googleAcademico";
import { importarPaginaGoogle, mesmoTitulo, resumoGoogle } from "@/lib/googleAcademico";
import { citacoesDaPublicacao, resumoCitacoes } from "@/lib/citacoes";

// Mesma estrutura da página real do perfil (classes gsc_*)
const linha = (titulo: string, autores: string, veiculo: string, ano: number, cit: string) =>
  `<tr class="gsc_a_tr"><td class="gsc_a_t"><a href="/citations?x" class="gsc_a_at">${titulo}</a><div class="gs_gray">${autores}</div>` +
  `<div class="gs_gray">${veiculo}<span class="gs_oph">, ${ano}</span></div></td><td class="gsc_a_c"><a href="" class="gsc_a_ac gs_ibl">${cit}</a></td>` +
  `<td class="gsc_a_y"><span class="gsc_a_h gsc_a_hc gs_ibl">${ano}</span></td></tr>`;

const PAGINA =
  `<div id="gsc_prf_in">ROSA, D. R.</div>` +
  `<table id="gsc_rsb_st"><thead><tr><th class="gsc_rsb_sth"></th><th class="gsc_rsb_sth">Todos</th><th class="gsc_rsb_sth">Desde 2021</th></tr></thead>` +
  `<tbody><tr><td class="gsc_rsb_std">1.204</td><td class="gsc_rsb_std">900</td></tr><tr><td class="gsc_rsb_std">3</td><td class="gsc_rsb_std">2</td></tr>` +
  `<tr><td class="gsc_rsb_std">1</td><td class="gsc_rsb_std">1</td></tr></tbody></table>` +
  `<span class="gsc_g_t" style="right:67px">2024</span><span class="gsc_g_t" style="right:35px">2025</span><span class="gsc_g_t" style="right:3px">2026</span>` +
  // 2025 sem barra (zero citações)
  `<a href="javascript:void(0)" class="gsc_g_a" style="right:65px;top:1px"><span class="gsc_g_al">4</span></a>` +
  `<a href="javascript:void(0)" class="gsc_g_a" style="right:1px;top:1px"><span class="gsc_g_al">7</span></a>` +
  `<table>` +
  linha("Segurança na Passagem de Plantão em Enfermagem: A Comunicação Efetiva e a Ferramenta SBAR: Not applicable.", "D da Rocha Rosa", "Nursing Edição Brasileira 32 (341)", 2026, "12") +
  linha("Atenção Primária &amp; Saúde", "D Rosa, F Silva", "Revista X", 2026, "") +
  linha("Trabalho só no Google", "D Rosa", "Anais", 2025, "2") +
  `</table><button type="button" id="gsc_bpf_more" disabled class="gs_btnPD">`;

describe("Google Acadêmico", () => {
  it("entende o link do perfil", () => {
    expect(idDoPerfil("https://scholar.google.com.br/citations?hl=pt-BR&user=4kOqC3cAAAAJ")).toBe("4kOqC3cAAAAJ");
    expect(idDoPerfil("4kOqC3cAAAAJ")).toBe("4kOqC3cAAAAJ");
    expect(idDoPerfil("https://google.com")).toBeNull();
  });

  it("lê números, gráfico por ano e trabalhos da página", () => {
    const p = lerPerfilGoogle(PAGINA);
    expect(p).toMatchObject({ nome: "ROSA, D. R.", citacoes: 1204, citacoesDesde: 900, h: 3, hDesde: 2, i10: 1, i10Desde: 1, anoDesde: 2021, temMais: false });
    expect(p.porAno).toEqual([{ ano: 2024, total: 4 }, { ano: 2025, total: 0 }, { ano: 2026, total: 7 }]);
    expect(p.artigos).toHaveLength(3);
    expect(p.artigos[0]).toMatchObject({ autores: "D da Rocha Rosa", veiculo: "Nursing Edição Brasileira 32 (341)", ano: 2026, citacoes: 12 });
    expect(p.artigos[1]).toMatchObject({ titulo: "Atenção Primária & Saúde", citacoes: 0 });
    expect(paginaBloqueada(PAGINA)).toBe(false);
    expect(paginaBloqueada('<form id="gs_captcha_f">unusual traffic</form>')).toBe(true);
  });

  it("aceita título com texto a mais no fim", () => {
    expect(mesmoTitulo("Segurança na Passagem de Plantão em Enfermagem: A Comunicação Efetiva e a Ferramenta SBAR", "SEGURANÇA NA PASSAGEM DE PLANTÃO EM ENFERMAGEM: A COMUNICAÇÃO EFETIVA E A FERRAMENTA SBAR: Not applicable.")).toBe(true);
    expect(mesmoTitulo("Gestão hospitalar", "Gestão hospitalar no SUS e no mundo inteiro")).toBe(false);
  });

  it("liga os trabalhos às publicações e guarda a foto do mês", async () => {
    const ctx = await novoAmbiente();
    const a = await criarPublicacao(ctx, artigo(ctx, { titulo: "Segurança na passagem de plantão em enfermagem: a comunicação efetiva e a ferramenta SBAR", ano: 2026 }));
    const b = await criarPublicacao(ctx, artigo(ctx, { titulo: "Atenção primária & saúde", ano: 2026 }));
    const r = importarPaginaGoogle(ctx.donoId, PAGINA);
    expect(r).toMatchObject({ artigos: 3, vinculados: 2, citacoes: 1204, h: 3 });
    expect(r.foraDoSistema.map((x) => x.titulo)).toEqual(["Trabalho só no Google"]);
    expect(citacoesDaPublicacao(a).atuais.find((x) => x.fonte === "Google Acadêmico")?.total).toBe(12);
    expect(citacoesDaPublicacao(b).atuais.find((x) => x.fonte === "Google Acadêmico")?.total).toBe(0);
    expect(resumoCitacoes(ctx.donoId).atuais.find((x) => x.fonte === "Google Acadêmico")).toMatchObject({ total: 12, h: 1 });
    const g = resumoGoogle(ctx.donoId);
    expect(g.atual).toMatchObject({ citacoes: 1204, h: 3, ano_desde: 2021 });
    expect(g.atual?.artigos.filter((x) => x.publicacao_id)).toHaveLength(2);
    // de novo no mesmo mês: substitui, não duplica
    importarPaginaGoogle(ctx.donoId, PAGINA);
    expect(resumoGoogle(ctx.donoId).serie).toHaveLength(1);
  });

  it("perfil sem citações ainda (sem a tabela de números)", async () => {
    const ctx = await novoAmbiente();
    const r = importarPaginaGoogle(ctx.donoId, `<div id="gsc_prf_in">X</div><table>${linha("Um trabalho qualquer novo", "X", "Y", 2026, "")}</table>`);
    expect(r).toMatchObject({ citacoes: 0, h: 0 });
  });
});
