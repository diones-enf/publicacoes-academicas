// Lê e-mails, declarações e cartas das revistas (português, inglês e espanhol)
// e descobre: o que aconteceu (submissão, avaliação, revisão, aceite, recusa,
// publicação), quando, qual artigo, qual revista, número do manuscrito, prazo...
// Tudo por regras: funciona sem internet e nada sai do computador.
import { todos } from "./db";
import { encontrarDoi, hojeIso, normalizar, normalizarIssn, numeroBr, somarDias } from "./texto";

export interface Achado<T = string> {
  valor: T;
  trecho: string; // pedaço do texto onde foi achado, para conferir
}

export interface LeituraDocumento {
  categoria: string; // tipo de anexo
  status: Achado | null;
  data: Achado | null; // data do acontecimento (submissão, aceite...)
  titulo: Achado | null;
  revista: Achado | null;
  issn: Achado | null;
  idSubmissao: Achado | null;
  prazo: Achado | null;
  rodada: Achado<number> | null;
  doi: Achado | null;
  link: Achado | null;
  editor: Achado | null;
  valor: Achado<{ valor: number; moeda: string }> | null;
  publicacao: { id: number; titulo: string; motivo: string } | null;
  veiculoId: number | null;
  resumo: string; // frase para mostrar ("Parece uma carta de aceite de 12/03/2026")
}

// ---------- texto sem acento, com as mesmas posições do original ----------

function simples(t: string): string {
  let r = "";
  for (const ch of t.split("")) {
    const b = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    r += (b[0] ?? ch).toLowerCase()[0] ?? ch;
  }
  return r;
}

function trechoEm(texto: string, inicio: number, fim: number): string {
  const a = Math.max(0, inicio - 40);
  const b = Math.min(texto.length, fim + 40);
  return `${a > 0 ? "…" : ""}${texto.slice(a, b).replace(/\s+/g, " ").trim()}${b < texto.length ? "…" : ""}`;
}

/** Só a mensagem nova: corta o histórico citado ("Em ... escreveu:", "On ... wrote:", "-----Original Message-----"). */
export function semHistorico(texto: string): string {
  const s = simples(texto);
  const marcas = [
    /\n[^\n]{0,200}\b(escreveu|wrote|escribio)\s*:\s*\n/,
    /\n-{2,}\s*(original message|mensagem original|mensaje original|forwarded message|mensagem encaminhada)/,
    /\n_{8,}\n(de|from):/,
  ];
  let corte = texto.length;
  for (const m of marcas) {
    const r = m.exec(s);
    if (r && r.index > 80 && r.index < corte) corte = r.index;
  }
  return texto.slice(0, corte);
}

// ---------- datas ----------

const MESES: [RegExp, number][] = [
  [/^(jan|janeiro|january|enero)$/, 1],
  [/^(fev|fevereiro|feb|february|febrero)$/, 2],
  [/^(mar|marco|march|marzo)$/, 3],
  [/^(abr|abril|apr|april)$/, 4],
  [/^(mai|maio|may|mayo)$/, 5],
  [/^(jun|junho|june|junio)$/, 6],
  [/^(jul|julho|july|julio)$/, 7],
  [/^(ago|agosto|aug|august)$/, 8],
  [/^(set|setembro|sep|sept|september|septiembre|setiembre)$/, 9],
  [/^(out|outubro|oct|october|octubre)$/, 10],
  [/^(nov|novembro|november|noviembre)$/, 11],
  [/^(dez|dezembro|dec|december|diciembre|dic)$/, 12],
];
const MES = "(jan(?:eiro|uary)?|enero|fev(?:ereiro)?|feb(?:ruary|rero)?|mar(?:co|ch|zo)?|abr(?:il)?|apr(?:il)?|mai(?:o)?|may(?:o)?|jun(?:ho|e|io)?|jul(?:ho|y|io)?|ago(?:sto)?|aug(?:ust)?|set(?:embro|iembre)?|sep(?:t(?:ember)?|tiembre)?|out(?:ubro)?|oct(?:ober|ubre)?|nov(?:embro|ember|iembre)?|dez(?:embro)?|dec(?:ember)?|dic(?:iembre)?)";

function numMes(m: string): number | null {
  const x = m.replace(/\.$/, "");
  return MESES.find(([r]) => r.test(x))?.[1] ?? null;
}

function iso(a: number, m: number, d: number): string | null {
  const ano = a < 100 ? 2000 + a : a;
  if (ano < 1990 || ano > Number(hojeIso().slice(0, 4)) + 2 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(ano, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${ano}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface DataAchada {
  iso: string;
  ini: number;
  fim: number;
}

export function encontrarDatas(texto: string): DataAchada[] {
  const s = simples(texto);
  const r: DataAchada[] = [];
  const add = (m: RegExpExecArray, v: string | null) => v && r.push({ iso: v, ini: m.index, fim: m.index + m[0].length });
  let m: RegExpExecArray | null;
  const numerica = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g;
  while ((m = numerica.exec(s))) {
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    add(m, b > 12 && a <= 12 ? iso(c, a, b) : iso(c, b, a));
  }
  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = isoRe.exec(s))) add(m, iso(Number(m[1]), Number(m[2]), Number(m[3])));
  const extenso = new RegExp(`\\b(\\d{1,2})(?:º|o|st|nd|rd|th)?\\s*(?:de\\s+)?${MES}\\.?,?\\s*(?:de\\s+|del\\s+)?(\\d{4})\\b`, "g");
  while ((m = extenso.exec(s))) {
    const mes = numMes(m[2]);
    if (mes) add(m, iso(Number(m[3]), mes, Number(m[1])));
  }
  const ingles = new RegExp(`\\b${MES}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "g");
  while ((m = ingles.exec(s))) {
    const mes = numMes(m[1]);
    if (mes) add(m, iso(Number(m[3]), mes, Number(m[2])));
  }
  return r.sort((x, y) => x.ini - y.ini);
}

// ---------- o que aconteceu ----------

interface Regra {
  status: string | null;
  categoria: string;
  rotulo: string;
  re: RegExp;
}

const REGRAS: Regra[] = [
  {
    status: "Recusado",
    categoria: "Carta de decisão (recusa)",
    rotulo: "uma recusa",
    re: /(\breject(ed|ion)\b|decided to decline|decline[ds]? (your|the|this) (manuscript|paper|submission|article)|not (be )?(accepted|suitable|considered) for|not to (accept|publish|proceed)|unable to (accept|publish|offer)|cannot (accept|publish)|nao (foi|sera|podera ser|pode ser) (aceit|aprovad|publicad)|decidiu (pela )?(recusa|rejeic|nao)|\brecusad|\brejeitad|\breprovad|\bindeferid|nao aprovad|decisao: (recus|rejeit|reprov)|\brechazad|no ha sido aceptad|desk reject)/,
  },
  {
    status: "Retirado",
    categoria: "Outro",
    rotulo: "uma retirada da submissão",
    re: /(has been withdrawn|withdrawal (of|request)|submissao (foi )?retirada|retirada da submissao|pedido de retirada|retirad[oa] a pedido)/,
  },
  {
    status: "Publicado",
    categoria: "Versão publicada (PDF)",
    rotulo: "um aviso de publicação",
    re: /(has been published|was published|is now (published|available online|online|live)|published online|foi publicad|esta publicad|encontra-se publicad|ja (esta|se encontra) (disponivel|publicad)|(?<!(ser|sera|a ser|vai ser|to be|will be) )publicad[oa] (no|na|em) (volume|v\.|numero|edicao|fasciculo)|ha sido publicad|declaramos .{0,250}(foi|esta|encontra-se) publicad|certificamos .{0,250}(foi|esta|encontra-se) publicad)/,
  },
  {
    status: "Apresentado",
    categoria: "Certificado",
    rotulo: "um certificado de apresentação",
    re: /((certificamos|certifica-se|declaramos|certify|certifies) (que|that).{0,400}(apresent|presented|exposicao oral|poster|po?ster))|apresentou o trabalho|apresentaram o trabalho/,
  },
  {
    status: "Aceito",
    categoria: "Carta de aceite",
    rotulo: "uma carta de aceite",
    re: /(accepted for publication|has been (formally )?accepted|is accepted|been accepted for|decision:? accept\b|decisao:? aceit|aceit[oa] para (a )?publicacao|(foi|esta|encontra-se) aceit|(foi|esta) aprovad[oa]|aprovad[oa] para (a )?publicacao|aceptad[oa] para (su )?publicacion|ha sido aceptad|carta de aceite|letter of acceptance|acceptance letter|aceite (do|de seu|do seu) (artigo|manuscrito|trabalho))/,
  },
  {
    status: "Em revisão",
    categoria: "Pareceres dos revisores",
    rotulo: "um pedido de correções (revisão)",
    re: /(major revision|minor revision|revisions? (are |is )?(required|requested|needed)|revise and resubmit|requires? (major |minor |some )?revisions?|revise your (manuscript|paper)|submit a revised|resubmit (a |your )?revised|correcoes (obrigatorias|solicitadas|necessarias|sugeridas)|modificacoes (obrigatorias|solicitadas|necessarias|sugeridas)|revisoes (obrigatorias|solicitadas|necessarias)|ajustes (solicitados|necessarios|obrigatorios)|(realizar|fazer|efetuar) (as )?(correcoes|alteracoes|ajustes|modificacoes)|devolvid[oa] (para|ao autor para|aos autores para) (correc|ajust|revis)|decisao:? (correcoes|revisoes|modificacoes|aceito com)|aceit[oa] com (correcoes|modificacoes|ressalvas)|requiere(n)? (modificaciones|cambios|correcciones))/,
  },
  {
    status: "Em avaliação",
    categoria: "Comprovante de submissão",
    rotulo: "um aviso de que o artigo está em avaliação",
    re: /(under (peer[- ])?review|sent (out )?(to|for) (peer[- ])?review|(assigned|sent) to (an? )?(editor|reviewers?|referees?)|em avaliacao|em processo de avaliacao|em fase de avaliacao|encaminhad[oa] (aos|para os?|para as?|a) (avaliador|parecerist|revisor|avaliac|revisao por pares)|em revisao por pares|en (proceso de )?evaluacion|enviado a (evaluadores|revisores))/,
  },
  {
    status: "Submetido",
    categoria: "Comprovante de submissão",
    rotulo: "uma confirmação de submissão",
    re: /(submission (has been |was )?(received|successful|completed|confirmed)|successfully submitted|has been submitted|thank you for (your )?submi|we (have )?received your (manuscript|submission|paper|article)|acknowledg(e|ement|ment) (of|receipt)|recebemos (a |o )?(sua |seu )?(submissao|manuscrito|artigo|trabalho)|submissao (recebida|realizada|concluida|efetuada|confirmada)|(foi|ter sido|tenha sido) submetid|declaramos .{0,300}submetid|confirmamos (o )?recebimento|agradecemos (a|pela) (sua )?submissao|recibimos su|ha sido (recibido|enviado)|envio (recebido|realizado|concluido))/,
  },
  {
    status: null,
    categoria: "Comprovante de pagamento",
    rotulo: "um comprovante de pagamento",
    re: /(comprovante de pagamento|pagamento (confirmado|recebido|efetuado|realizado|aprovado)|payment (received|confirmed|successful|completed)|\binvoice\b|\brecibo\b|\bfatura\b|nota fiscal|\bboleto\b|comprovante de (transferencia|pix|deposito))/,
  },
];

// ---------- leitura ----------

function primeiro(re: RegExp, texto: string, grupo = 1): Achado | null {
  const m = re.exec(texto);
  if (!m || !m[grupo]) return null;
  return { valor: m[grupo].trim(), trecho: trechoEm(texto, m.index, m.index + m[0].length) };
}

function limparTitulo(t: string): string {
  return t
    .replace(/\s+/g, " ")
    .replace(/^[\s"“”'«»:–-]+|[\s"“”'«»,;:.–-]+$/g, "")
    .trim();
}

const PALAVRA_REVISTA = /^(revista|journal|jornal|cadernos?|anais|archives?|annals|acta|arquivos|international|brazilian|ciencia|saude|enfermagem|texto|escola|cogitare|online|rev\b)/;

function limparRevista(t: string): string {
  let r = t.replace(/\s+/g, " ").replace(/^(the|a|o)\s+/i, "").trim();
  // corta no primeiro trecho que já não é nome (ex.: "Revista X and we are pleased")
  r = r.split(/\s+(?:and we|e (?:informamos|gostariamos|temos)|we are|has been|foi|was|is|para|que|with|com o|on |em \d)/i)[0];
  r = r.replace(/[\s,;:.–-]+$/g, "");
  // tira palavras de ligação soltas no fim ("Revista Tópicos e")
  r = r.replace(/(\s+(de|da|do|dos|das|e|and|of|the|em|in|for|&|y|del|la|on))+$/i, "");
  return r.slice(0, 120);
}

export function lerDocumento(texto: string, donoId?: number): LeituraDocumento {
  const original = texto.replace(/\r/g, "");
  const atual = semHistorico(original); // só a mensagem nova
  const s = simples(atual);

  // 1. o que aconteceu
  let regra: Regra | null = null;
  let posStatus = -1;
  for (const r of REGRAS) {
    const m = r.re.exec(s);
    if (m) {
      regra = r;
      posStatus = m.index;
      break;
    }
  }
  const status = regra?.status ? { valor: regra.status, trecho: trechoEm(atual, posStatus, posStatus + 60) } : null;

  // 2. prazo para responder
  const todasDatas = encontrarDatas(atual);
  const datas = todasDatas.filter((d) => d.iso <= somarDias(hojeIso(), 1));
  let prazo: Achado | null = null;
  let prazoPos = -1;
  for (const d of todasDatas) {
    const antes = s.slice(Math.max(0, d.ini - 60), d.ini);
    const linha = s.slice(s.lastIndexOf("\n", d.ini) + 1, d.ini);
    if (/^\s*(data|date|sent|enviad[oa](?: em)?|fecha|de|from)\s*:/.test(linha)) continue; // cabeçalho do e-mail
    if (/\b(due|deadline|prazo|ate o dia|ate|until|by|no later than|antes de|plazo|hasta|limite)\b[^.]{0,40}$/.test(antes)) {
      prazo = { valor: d.iso, trecho: trechoEm(atual, d.ini - 30, d.fim) };
      prazoPos = d.ini;
      break;
    }
  }

  // 3. data do acontecimento (cabeçalho do e-mail, "submetido em", "Cidade, 5 de março de 2026", perto da frase)
  let data: Achado | null = null;
  const candidatas = datas.filter((d) => d.ini !== prazoPos);
  const cab = /(^|\n)\s*(data|date|sent|enviad[oa](?: em)?|fecha)\s*:\s*([^\n]+)/.exec(s);
  const especifica = /(submitted on|submission date|date submitted|date of submission|data de submissao|data da submissao|submetid[oa] em|recebid[oa] em|received on|accepted on|data de aceite|aceit[oa] em|publicad[oa] em|published on|aprovad[oa] em)\s*:?\s*/.exec(s);
  const perto = (pos: number, raio: number) => candidatas.find((d) => Math.abs(d.ini - pos) <= raio);
  const dEsp = especifica ? candidatas.find((d) => d.ini >= especifica.index && d.ini - (especifica.index + especifica[0].length) <= 15) : undefined;
  const dCab = cab ? candidatas.find((d) => d.ini >= cab.index && d.ini <= cab.index + cab[0].length) : undefined;
  // linha "Cidade, 5 de setembro de 2026." (declarações e cartas)
  const dLocal = candidatas.find((d) => /(^|\n)\s*[a-z][a-z .'-]{2,40}(\/[a-z]{2})?\s*,\s*$/.test(s.slice(Math.max(0, d.ini - 50), d.ini)));
  const escolhida = dEsp ?? dCab ?? dLocal ?? (posStatus >= 0 ? perto(posStatus, 150) : undefined) ?? candidatas.at(-1);
  if (escolhida) data = { valor: escolhida.iso, trecho: trechoEm(atual, escolhida.ini, escolhida.fim) };
  if (prazo && data && prazo.valor <= data.valor) prazo = null;
  if (!prazo) {
    const m = /(within|dentro de|em ate|no prazo de|prazo de|en un plazo de|plazo de)\s+(\d{1,3})\s+(days|dias)/.exec(s);
    if (m) prazo = { valor: somarDias(data?.valor ?? hojeIso(), Number(m[2])), trecho: trechoEm(atual, m.index, m.index + m[0].length) };
  }

  // 4. número do manuscrito
  const idRe = [
    /(?:manuscript|submission|paper|article|ms\.?)\s*(?:id|number|no\.?|n[ºo°]\.?|#|code)\s*[:.#]?\s*(?:is\s+)?([A-Za-z]{0,12}[-A-Za-z0-9_./]*\d[-A-Za-z0-9_./]*)/i,
    /(?:id|n[uú]mero|c[oó]digo|n[ºo°]\.?|registro)\s*(?:do|da|de)?\s*(?:manuscrito|submiss[aã]o|artigo|trabalho)\s*[:.#]?\s*(?:[ée]\s+)?([A-Za-z]{0,12}[-A-Za-z0-9_./]*\d[-A-Za-z0-9_./]*)/i,
    /submiss(?:ion|[aã]o)\s*#\s*(\d+)/i,
    /\b([A-Z]{2,10}-\d{4}-\d{2,6}(?:\.R\d)?)\b/,
    /\b([A-Z]{2,10}-[A-Z]-\d{2}-\d{3,6}(?:R\d)?)\b/,
    /(?:manuscript|manuscrito|manuscrit)\s+([A-Z]{2,}[-A-Z0-9]*\d[-A-Z0-9]*)/,
  ];
  let idSubmissao: Achado | null = null;
  for (const re of idRe) if (!idSubmissao) idSubmissao = primeiro(re, atual);
  if (!idSubmissao) {
    const l = /(?:authorDashboard\/submission|submission|workflow\/index)\/(\d{2,8})\b/i.exec(atual);
    if (l) idSubmissao = { valor: l[1], trecho: trechoEm(atual, l.index, l.index + l[0].length) };
  }
  if (idSubmissao) idSubmissao.valor = idSubmissao.valor.replace(/[.,;:]+$/, "");

  // 5. rodada
  let rodada: Achado<number> | null = null;
  const rod = /(\d)\s*(?:ª|a|st|nd|rd|th)?\s*(?:rodada|round)|(first|second|third|primeira|segunda|terceira)\s+(?:round|rodada)|\.R(\d)\b/i.exec(atual);
  if (rod) {
    const palavras: Record<string, number> = { first: 1, primeira: 1, second: 2, segunda: 2, third: 3, terceira: 3 };
    const n = Number(rod[1] ?? rod[3]) || palavras[(rod[2] ?? "").toLowerCase()] || null;
    if (n) rodada = { valor: n, trecho: trechoEm(atual, rod.index, rod.index + rod[0].length) };
  }

  // 6. publicação e revista já cadastradas, citadas no texto
  const norm = ` ${normalizar(original)} `;
  let publicacao: LeituraDocumento["publicacao"] = null;
  let veiculoId: number | null = null;
  let titulo: Achado | null = null;
  let revista: Achado | null = null;
  if (donoId) {
    const pubs = todos<{ id: number; titulo: string; titulo_normalizado: string; id_submissao: string | null; veiculo_id: number | null; status: string }>(
      "SELECT id, titulo, titulo_normalizado, id_submissao, veiculo_id, status FROM publicacao WHERE dono_id = ?",
      donoId,
    );
    const porId = idSubmissao ? pubs.find((p) => p.id_submissao && normalizar(p.id_submissao) === normalizar(idSubmissao!.valor)) : undefined;
    const porTitulo = pubs
      .filter((p) => p.titulo_normalizado.length >= 20 && norm.includes(` ${p.titulo_normalizado} `))
      .sort((a, b) => b.titulo_normalizado.length - a.titulo_normalizado.length)[0];
    const achada = porId ?? porTitulo;
    if (achada) {
      publicacao = { id: achada.id, titulo: achada.titulo, motivo: porId ? "mesmo número de manuscrito" : "título citado no documento" };
      titulo = { valor: achada.titulo, trecho: "título já cadastrado no sistema" };
    }
    const veics = todos<{ id: number; nome: string }>("SELECT id, nome FROM veiculo WHERE dono_id = ?", donoId)
      .map((v) => ({ ...v, n: normalizar(v.nome) }))
      .filter((v) => v.n.length >= 6 && norm.includes(` ${v.n} `))
      .sort((a, b) => b.n.length - a.n.length);
    if (veics[0]) {
      veiculoId = veics[0].id;
      revista = { valor: veics[0].nome, trecho: "revista já cadastrada no sistema" };
    }
    if (!publicacao && veiculoId) {
      // uma única submissão em andamento nessa revista: provavelmente é ela
      const naRevista = pubs.filter((p) => p.veiculo_id === veiculoId && !["Publicado", "Apresentado", "Recusado", "Retirado"].includes(p.status));
      if (naRevista.length === 1) publicacao = { id: naRevista[0].id, titulo: naRevista[0].titulo, motivo: "única submissão em andamento nessa revista" };
    }
  }

  // 7. título escrito no documento
  if (!titulo) {
    const res = [
      /(?:entitled|titled|intitulad[oa]|titulad[oa]|com o t[ií]tulo|sob o t[ií]tulo|cujo t[ií]tulo [ée]|t[ií]tulo(?: do (?:artigo|manuscrito|trabalho))?|title(?: of (?:the |your )?(?:paper|manuscript|article|submission))?|manuscript|manuscrito|artigo|trabalho|art[ií]culo)\s*[:\-–]?\s*["“'«‘]([^"”'»’]{12,350})["”'»’]/i,
      /(?:^|\n)\s*(?:t[ií]tulo|title|manuscript title|t[ií]tulo do (?:artigo|manuscrito|trabalho))\s*:\s*([^\n]{12,350})/i,
      /["“«]([^"”»]{25,350})["”»]/,
    ];
    for (const re of res) {
      const a = primeiro(re, atual);
      if (a) {
        titulo = { ...a, valor: limparTitulo(a.valor) };
        break;
      }
    }
  }

  // 8. revista escrita no documento
  if (!revista) {
    const res = [
      /(?:published in|publicad[oa] em|submitted to|submission to|submit(?:ted)? (?:it )?to|submetid[oa] (?:à|a|na|para a?)|submiss[aã]o (?:à|a|na|para a?)|publicad[oa] na|aceit[oa] (?:pela|na)|enviad[oa] (?:à|a|para a?)|on behalf of|em nome da|editorial board of|comit[eê] editorial d[ao]|equipe editorial d[ao]|editores? d[ao]|editor(?:-in-chief)? of|consideration (?:for publication )?in|publication in)\s+(?:the\s+)?([A-ZÀ-Ú][^\n,.;:()"“”]{3,110})/,
      /\b((?:Revista|Journal|Jornal|Cadernos?|Archives?|Annals|Acta|Arquivos|International Journal|Brazilian Journal|Rev\.)\s+(?:(?:de|da|do|dos|das|of|and|&|e|em|in|for|the|on|y|del|la)\s+|[A-ZÀ-Ú][\wÀ-ú\-]*\s*){1,12})/,
    ];
    for (const re of res) {
      const a = primeiro(re, atual);
      if (a) {
        const v = limparRevista(a.valor);
        if (v.length >= 4 && (re !== res[0] || PALAVRA_REVISTA.test(simples(v)) || /^[A-ZÀ-Ú]/.test(v))) {
          revista = { ...a, valor: v };
          break;
        }
      }
    }
  }
  const issnA = primeiro(/(?:e-?ISSN|ISSN)[^\d]{0,15}(\d{4}-?\d{3}[\dXx])/i, original);
  const issn = issnA && normalizarIssn(issnA.valor) ? { ...issnA, valor: normalizarIssn(issnA.valor)! } : null;

  // 9. DOI (só faz sentido em aceite/publicação), link do sistema, editor, valor
  const doiV = regra && ["Publicado", "Aceito"].includes(regra.status ?? "") ? encontrarDoi(atual) : null;
  const doi = doiV ? { valor: doiV, trecho: doiV } : null;
  const links = [...atual.matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map((m) => m[0].replace(/[.,;]+$/, ""));
  const linkV = links.find((l) => /(submission|authordashboard|workflow|manuscriptcentral|editorialmanager|index\.php|ojs|review)/i.test(l));
  const link = linkV ? { valor: linkV, trecho: linkV } : null;
  let editor: Achado | null = null;
  const ass = /(sincerely|best regards|kind regards|warm regards|with regards|yours sincerely|regards|atenciosamente|cordialmente|cordiais saudacoes|respeitosamente|saudacoes|att\.?|abracos|un saludo|saludos cordiales|saludos)[,.!]?\s*\n+\s*/.exec(s);
  if (ass) {
    const linha = atual.slice(ass.index + ass[0].length).split("\n").map((l) => l.trim()).find((l) => l.length >= 3);
    if (linha && linha.length <= 80 && !/[@:/]|\d{3}/.test(linha) && /^[A-ZÀ-Ú]/.test(linha) && !/\b(revista|journal|editorial|equipe|office|team|comiss[aã]o|secretaria|editora)\b/i.test(linha)) editor = { valor: linha.replace(/[,.]$/, ""), trecho: trechoEm(atual, ass.index, ass.index + ass[0].length + linha.length) };
  }
  if (editor && revista && normalizar(editor.valor) === normalizar(revista.valor)) editor = null;
  let valor: LeituraDocumento["valor"] = null;
  const vm = /(R\$|US\$|USD|EUR|€|U\$)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/.exec(atual);
  if (vm) {
    const moeda = vm[1] === "R$" ? "BRL" : vm[1] === "EUR" || vm[1] === "€" ? "EUR" : "USD";
    const bruto = moeda === "BRL" ? vm[2] : vm[2].replace(/,(\d{3})/g, "$1").replace(/\.(\d{2})$/, ",$1");
    const n = numeroBr(bruto);
    if (n !== null) valor = { valor: { valor: n, moeda }, trecho: trechoEm(atual, vm.index, vm.index + vm[0].length) };
  }

  const categoria = regra?.categoria ?? (/(declara|certifica)/.test(s) ? "Outro" : "Outro");
  const partes: string[] = [];
  if (regra) partes.push(`Parece ${regra.rotulo}`);
  else partes.push("Não reconheci o tipo do documento");
  if (data) partes.push(`de ${data.valor.split("-").reverse().join("/")}`);
  if (revista) partes.push(`(${revista.valor})`);

  return {
    categoria,
    status,
    data,
    titulo,
    revista,
    issn,
    idSubmissao,
    prazo: status?.valor === "Em revisão" ? prazo : prazo && regra?.status !== "Publicado" ? prazo : null,
    rodada: status?.valor === "Em revisão" ? rodada : null,
    doi,
    link,
    editor,
    valor,
    publicacao,
    veiculoId,
    resumo: `${partes.join(" ")}.`,
  };
}
