// Gráficos simples em SVG (sem biblioteca), legíveis na tela e na impressão.
import type { Grafico } from "@/lib/relatorios";
import type { LinhaRanking } from "@/lib/coautores";

const CORES = ["#1d4f91", "#d98a00", "#1b6b3a", "#a4161a"];

export function GraficoBarras({ g }: { g: Grafico }) {
  if (!g.rotulos.length) return null;
  const largura = Math.max(560, g.rotulos.length * 48);
  const altura = 240;
  const margem = { esq: 64, dir: 12, topo: 12, base: 46 };
  const totais = g.rotulos.map((_, i) => g.series.reduce((s, x) => s + (x.valores[i] ?? 0), 0));
  const max = Math.max(1, ...totais);
  const passo = (largura - margem.esq - margem.dir) / g.rotulos.length;
  const barra = Math.min(36, passo * 0.7);
  const y = (v: number) => margem.topo + (altura - margem.topo - margem.base) * (1 - v / max);
  const fmt = (v: number) => (g.moeda ? `R$ ${Math.round(v).toLocaleString("pt-BR")}` : String(Math.round(v * 10) / 10).replace(".", ","));
  return (
    <figure className="grafico" style={{ margin: 0 }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 4 }}>{g.titulo}</figcaption>
      <div className="tabela-rolagem">
        <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={g.titulo} style={{ minWidth: Math.min(largura, 560) }}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={margem.esq} x2={largura - margem.dir} y1={y(max * t)} y2={y(max * t)} stroke="#d5dae1" />
              <text x={margem.esq - 6} y={y(max * t) + 4} fontSize="11" textAnchor="end" fill="#4d5662">{fmt(max * t)}</text>
            </g>
          ))}
          {g.rotulos.map((r, i) => {
            let acumulado = 0;
            const x = margem.esq + i * passo + (passo - barra) / 2;
            return (
              <g key={r}>
                {g.series.map((s, k) => {
                  const v = s.valores[i] ?? 0;
                  const topo = y(acumulado + v);
                  const h = y(acumulado) - topo;
                  acumulado += v;
                  return v > 0 ? (
                    <rect key={k} x={x} y={topo} width={barra} height={h} fill={CORES[k % CORES.length]}>
                      <title>{`${r} — ${s.nome}: ${fmt(v)}`}</title>
                    </rect>
                  ) : null;
                })}
                <text x={x + barra / 2} y={altura - margem.base + 16} fontSize="11" textAnchor="middle" fill="#1b1f24">{r}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {g.series.length > 1 && (
        <div className="legenda">
          {g.series.map((s, k) => <span key={s.nome} style={{ ["--cor" as string]: CORES[k % CORES.length] }}>{s.nome}</span>)}
        </div>
      )}
    </figure>
  );
}

export function RedeColaboracao({ nos, arestas }: { nos: LinhaRanking[]; arestas: { a: number; b: number; peso: number }[] }) {
  if (!nos.length) return <p className="suave">Sem coautores no período.</p>;
  const tam = 520;
  const c = tam / 2;
  const raio = tam / 2 - 90;
  const max = Math.max(...nos.map((n) => n.trabalhos));
  const pos = new Map(nos.map((n, i) => {
    const ang = (2 * Math.PI * i) / nos.length - Math.PI / 2;
    return [n.id, { x: c + raio * Math.cos(ang), y: c + raio * Math.sin(ang), ang }];
  }));
  return (
    <figure className="grafico" style={{ margin: 0, maxWidth: 620 }}>
      <figcaption style={{ fontWeight: 600 }}>Rede de colaboração (você no centro; linhas entre coautores que publicaram juntos)</figcaption>
      <svg viewBox={`0 0 ${tam} ${tam}`} role="img" aria-label="Rede de colaboração">
        {nos.map((n) => {
          const p = pos.get(n.id)!;
          return <line key={`c${n.id}`} x1={c} y1={c} x2={p.x} y2={p.y} stroke="#b7cbe8" strokeWidth={1 + (3 * n.trabalhos) / max} />;
        })}
        {arestas.map((a) => {
          const p = pos.get(a.a);
          const q = pos.get(a.b);
          return p && q ? <line key={`${a.a}-${a.b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#d98a00" strokeOpacity={0.6} strokeWidth={a.peso} /> : null;
        })}
        <circle cx={c} cy={c} r={16} fill="#12263f" />
        <text x={c} y={c + 4} fontSize="10" textAnchor="middle" fill="#fff">você</text>
        {nos.map((n) => {
          const p = pos.get(n.id)!;
          const direita = Math.cos(p.ang) >= 0;
          return (
            <g key={n.id}>
              <circle cx={p.x} cy={p.y} r={4 + (8 * n.trabalhos) / max} fill="#1d4f91">
                <title>{`${n.nome}: ${n.trabalhos} trabalho(s)`}</title>
              </circle>
              <text x={p.x + (direita ? 12 : -12)} y={p.y + 4} fontSize="10" textAnchor={direita ? "start" : "end"} fill="#1b1f24">
                {n.nome.length > 22 ? n.nome.slice(0, 21) + "…" : n.nome} ({n.trabalhos})
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
