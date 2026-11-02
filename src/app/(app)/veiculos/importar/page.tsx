import { exigirUsuario } from "@/lib/sessao";
import { listasImportadas } from "@/lib/planilhas";
import { dataBr } from "@/lib/texto";
import { FormLista } from "./FormLista";

export default async function Importar() {
  await exigirUsuario("autor");
  const historico = listasImportadas();
  return (
    <>
      <p><a href="/veiculos">← Revistas e veículos</a></p>
      <h1>Importar Qualis e JCR</h1>
      <p className="suave">
        A CAPES e a Clarivate não oferecem consulta automática gratuita. Você baixa a lista oficial uma vez e envia aqui: todas as
        suas revistas (as de hoje e as que cadastrar depois) recebem o Qualis e o JCR sozinhas, pelo ISSN, com o selo
        &quot;Confirmado na fonte oficial&quot;. Pode enviar vários arquivos (por exemplo, uma área ou categoria de cada vez): eles se somam.
      </p>

      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Qualis (CAPES / Plataforma Sucupira)</h2>
        <ol>
          <li>Abra a consulta pública do Qualis na Plataforma Sucupira: <a href="https://sucupira.capes.gov.br/sucupira/public/consultas/coleta/veiculoPublicacaoQualis/listaConsultaGeralPeriodicos.jsf" target="_blank" rel="noreferrer">sucupira.capes.gov.br → Qualis Periódicos</a>.</li>
          <li>Em <strong>Evento de Classificação</strong>, escolha o quadriênio (ex.: 2021-2024 ou 2017-2020).</li>
          <li>Em <strong>Área de Avaliação</strong>, escolha a sua (ex.: Enfermagem). Repita depois para outras áreas que interessem.</li>
          <li>Clique em <strong>Consultar</strong> e, no fim da lista, no botão de <strong>exportar a planilha</strong>.</li>
          <li>Se o arquivo vier como <strong>.xls</strong>, abra no Excel e use <em>Arquivo → Salvar como → Pasta de Trabalho do Excel (.xlsx)</em>.</li>
          <li>Envie o arquivo abaixo, escolhendo o mesmo quadriênio.</li>
        </ol>
        <p className="ajuda suave">Também serve a planilha de &quot;Qualis periódicos&quot; do portal de dados abertos da CAPES (dadosabertos.capes.gov.br), em CSV ou XLSX.</p>
        <FormLista tipo="qualis" />
      </section>

      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>JCR (Clarivate)</h2>
        <ol>
          <li>Acesse o JCR pelo Portal de Periódicos CAPES com o login da sua instituição (CAFe): <a href="https://jcr.clarivate.com" target="_blank" rel="noreferrer">jcr.clarivate.com</a>.</li>
          <li>Clique em <strong>Journals</strong> e filtre pela categoria (ex.: <em>Nursing</em>) e, se quiser, por edição (SCIE, SSCI, ESCI).</li>
          <li>Clique em <strong>Export</strong> e escolha <strong>CSV</strong> ou <strong>XLS</strong> (se vier .xls, salve como .xlsx no Excel).</li>
          <li>Envie o arquivo abaixo. Repita para outras categorias se precisar.</li>
        </ol>
        <p className="ajuda suave">Lembrete: revistas só da ESCI têm JIF a partir do JCR 2023, e estar no Web of Science não é o mesmo que ter JCR.</p>
        <FormLista tipo="jcr" />
      </section>

      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Buscadas sozinhas pela internet (não precisa importar)</h2>
        <ul>
          <li><strong>Scopus</strong>: indexação, SJR e quartil (lista pública do SCImago, atualizada a cada 6 meses).</li>
          <li><strong>DOAJ</strong>, <strong>PubMed/MEDLINE</strong> e <strong>SciELO</strong>: se a revista está indexada.</li>
          <li><strong>LILACS e BDENF</strong> não têm consulta pública automática: marque à mão na página da revista.</li>
        </ul>
      </section>

      {historico.length > 0 && (
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Listas já importadas</h2>
          <ul>
            {historico.map((h, i) => (
              <li key={i}>{h.tipo} {h.periodo} — {h.linhas.toLocaleString("pt-BR")} linhas — {h.arquivo} ({dataBr(h.em.slice(0, 10))})</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
