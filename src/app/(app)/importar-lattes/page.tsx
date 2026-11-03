import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { listarImportacoes } from "@/lib/importacaoLattes";
import { dataBr } from "@/lib/texto";
import { BotaoAcao } from "@/componentes/Acoes";
import { ImportarLattes } from "./ImportarLattes";

export default async function PaginaImportarLattes() {
  const u = await exigirUsuario("autor");
  const { donoId } = contextoDe(u);
  const historico = listarImportacoes(donoId);
  return (
    <>
      <h1>Importar do Lattes</h1>
      <p className="suave">
        Traz artigos (publicados e aceitos), trabalhos em eventos, livros, capítulos, textos em jornais e apresentações, com coautores e revistas.
        O que já está no sistema não é duplicado: só os campos vazios são completados, sem apagar o que você digitou.
      </p>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Como baixar o arquivo do Lattes</h2>
        <ol>
          <li>Entre em <a href="https://lattes.cnpq.br" target="_blank" rel="noreferrer">lattes.cnpq.br</a> e clique em <strong>Atualizar currículo</strong> (com seu login do CNPq).</li>
          <li>No seu currículo, procure o ícone ou menu <strong>Exportar</strong> e escolha <strong>XML</strong>.</li>
          <li>Baixa um arquivo <strong>.zip</strong>. Não precisa abrir: envie o próprio .zip abaixo.</li>
        </ol>
      </section>
      <ImportarLattes />
      {historico.length > 0 && (
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Importações feitas</h2>
          <ul className="lista-itens">
            {historico.map((h) => (
              <li key={h.id} className="acoes" style={{ justifyContent: "space-between" }}>
                <span>
                  {dataBr(h.em.slice(0, 10))} — {h.fonte} ({h.arquivo}): {h.criados} nova(s), {h.atualizados} completada(s)
                  {h.desfeita_em && <span className="selo" style={{ marginLeft: 6 }}>desfeita</span>}
                </span>
                {!h.desfeita_em && (
                  <BotaoAcao
                    url={`/api/lattes/desfazer/${h.id}`}
                    rotulo="Desfazer"
                    confirmar="Desfazer esta importação? As publicações criadas por ela serão apagadas e os campos que ela completou ficarão vazios de novo."
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
