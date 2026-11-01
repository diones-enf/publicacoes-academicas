// Cotação PTAX do Banco Central (API pública Olinda), usada para converter
// taxas pagas em dólar ou euro. Guarda as cotações já consultadas no banco.
import { executar, um } from "../db";
import { buscarJson } from "./http";

interface RespostaPtax {
  value: { cotacaoVenda: number; dataHoraCotacao: string; tipoBoletim: string }[];
}

function mmddaaaa(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${m}-${d}-${a}`;
}

function garantirTabela() {
  executar(
    "CREATE TABLE IF NOT EXISTS cotacao_cache (moeda TEXT NOT NULL, data TEXT NOT NULL, valor REAL NOT NULL, data_efetiva TEXT NOT NULL, PRIMARY KEY (moeda, data))",
  );
}

/**
 * Cotação de venda (boletim de fechamento) da data pedida. Em fim de semana
 * e feriado usa o último dia útil anterior (até 7 dias para trás).
 */
export async function cotacaoPtax(moeda: string, dataIso: string): Promise<{ valor: number; data: string }> {
  if (moeda === "BRL") return { valor: 1, data: dataIso };
  garantirTabela();
  const cache = um<{ valor: number; data_efetiva: string }>(
    "SELECT valor, data_efetiva FROM cotacao_cache WHERE moeda = ? AND data = ?",
    moeda,
    dataIso,
  );
  if (cache) return { valor: cache.valor, data: cache.data_efetiva };

  const fim = dataIso;
  const inicio = new Date(Date.parse(dataIso + "T00:00:00Z") - 7 * 86400000).toISOString().slice(0, 10);
  const url =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
    "CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
    `?@moeda='${moeda}'&@dataInicial='${mmddaaaa(inicio)}'&@dataFinalCotacao='${mmddaaaa(fim)}'&$format=json`;
  const r = await buscarJson<RespostaPtax>("Banco Central (PTAX)", url, { tempoMs: 8000 });
  const lista = (r?.value ?? []).filter((v) => v.tipoBoletim === "Fechamento" || v.tipoBoletim === "Fechamento PTAX");
  const ultimo = (lista.length ? lista : (r?.value ?? [])).at(-1);
  if (!ultimo) throw new Error(`Sem cotação PTAX de ${moeda} perto de ${dataIso}.`);
  const efetiva = ultimo.dataHoraCotacao.slice(0, 10);
  executar(
    "INSERT OR REPLACE INTO cotacao_cache (moeda, data, valor, data_efetiva) VALUES (?, ?, ?, ?)",
    moeda,
    dataIso,
    ultimo.cotacaoVenda,
    efetiva,
  );
  return { valor: ultimo.cotacaoVenda, data: efetiva };
}
