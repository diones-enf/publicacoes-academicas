import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { possiveisDuplicatas } from "@/lib/filtros";
import { BotaoAcao } from "@/componentes/Acoes";

export default async function Duplicatas() {
  const u = await exigirUsuario("autor");
  const { donoId } = contextoDe(u);
  const lista = possiveisDuplicatas(donoId);
  return (
    <>
      <h1>Possíveis duplicatas</h1>
      <p className="suave">Títulos pelo menos 90% parecidos no mesmo ano. Escolha o que fazer com cada par.</p>
      {lista.length === 0 && <div className="aviso ok">Nenhuma possível duplicata.</div>}
      {lista.map((d) => (
        <div key={`${d.a.id}-${d.b.id}`} className="cartao">
          <p><strong>A:</strong> <a href={`/publicacoes/${d.a.id}`}>{d.a.titulo}</a> {d.a.ano ? `(${d.a.ano})` : ""} {d.a.doi ? `· DOI ${d.a.doi}` : ""}</p>
          <p><strong>B:</strong> <a href={`/publicacoes/${d.b.id}`}>{d.b.titulo}</a> {d.b.ano ? `(${d.b.ano})` : ""} {d.b.doi ? `· DOI ${d.b.doi}` : ""}</p>
          <p className="suave">{Math.round(d.similaridade * 100)}% parecidos</p>
          <div className="acoes">
            <BotaoAcao url="/api/duplicatas" corpo={{ acao: "mesclar", a: d.a.id, b: d.b.id }} rotulo="Mesclar (fica A)" classe="pequeno" confirmar="Mesclar? B será apagada e o que estiver vazio em A será completado com B." />
            <BotaoAcao url="/api/duplicatas" corpo={{ acao: "mesclar", a: d.b.id, b: d.a.id }} rotulo="Mesclar (fica B)" confirmar="Mesclar? A será apagada e o que estiver vazio em B será completado com A." />
            <BotaoAcao url="/api/duplicatas" corpo={{ acao: "versoes", a: d.a.id, b: d.b.id }} rotulo="Ligar como versões relacionadas" />
            <BotaoAcao url="/api/duplicatas" corpo={{ acao: "manter", a: d.a.id, b: d.b.id }} rotulo="Manter os dois" />
          </div>
        </div>
      ))}
    </>
  );
}
