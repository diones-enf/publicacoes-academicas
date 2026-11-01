// Acesso: cadastro com CPF, senha numérica, bloqueio após 5 erros, sessão
// de 30 minutos sem uso, recuperação de senha e leitores convidados.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hash, verify } from "@node-rs/argon2";
import { executar, inserir, pastaDados, transacao, um, todos } from "./db";
import { cpfValido, mascararCpf, normalizarOrcid, soDigitos, nomeEmCitacao } from "./texto";
import { criarTiposPadrao } from "./tipos";

export const MAX_TENTATIVAS = 5;
export const MINUTOS_BLOQUEIO = 15;
export const MINUTOS_SESSAO = 30;

export class ErroAcesso extends Error {}

export interface Usuario {
  id: number;
  dono_id: number | null;
  perfil: "autor" | "leitor";
  cpf_mascara: string;
  nome: string;
  nomes_citacao: string;
  orcid: string | null;
  lattes_id: string | null;
  email: string | null;
  data_nascimento: string | null;
  area_qualis_ref: string | null;
  dias_sem_movimentacao: number;
  consentimento_em: string | null;
}

/** Id do autor dono dos dados (o próprio autor, ou o autor que convidou o leitor). */
export function donoDe(u: Pick<Usuario, "id" | "dono_id" | "perfil">): number {
  return u.perfil === "leitor" && u.dono_id ? u.dono_id : u.id;
}

// ---------- Chave secreta local ----------

let chaveCache: Buffer | null = null;
function chaveSecreta(): Buffer {
  if (chaveCache) return chaveCache;
  if (process.env.CHAVE_SECRETA) {
    chaveCache = Buffer.from(process.env.CHAVE_SECRETA);
    return chaveCache;
  }
  const arquivo = path.join(pastaDados(), "chave-secreta.txt");
  if (!fs.existsSync(arquivo)) {
    fs.writeFileSync(arquivo, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  chaveCache = Buffer.from(fs.readFileSync(arquivo, "utf8").trim());
  return chaveCache;
}

/** O CPF nunca é gravado: só esta impressão digital (HMAC) e a versão mascarada. */
export function cpfHmac(cpf: string): string {
  return crypto.createHmac("sha256", chaveSecreta()).update(soDigitos(cpf)).digest("hex");
}

function sha256(v: string): string {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function agora(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function maisMinutos(min: number): string {
  return new Date(Date.now() + min * 60000).toISOString().replace("T", " ").slice(0, 19);
}

// ---------- Regras da senha ----------

function datasProibidas(nascimento: string | null | undefined): string[] {
  if (!nascimento) return [];
  const m = nascimento.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return [];
  const [, a, mes, d] = m;
  const aa = a.slice(2);
  return [d + mes + a, d + mes + aa, a + mes + d, mes + d + a, d + mes, a];
}

/** Devolve a mensagem de erro, ou null se a senha for aceitável. */
export function problemaNaSenha(senha: string, nascimento?: string | null): string | null {
  if (!/^\d+$/.test(senha)) return "A senha deve ter somente números.";
  if (senha.length < 6 || senha.length > 8) return "A senha deve ter de 6 a 8 dígitos.";
  if (/^(\d)\1+$/.test(senha)) return "Senha muito óbvia (todos os dígitos iguais).";
  const sobe = "0123456789012";
  const desce = "9876543210987";
  if (sobe.includes(senha) || desce.includes(senha)) return "Senha muito óbvia (sequência).";
  if (/^(\d\d)\1+$/.test(senha) || /^(\d\d\d)\1+$/.test(senha)) return "Senha muito óbvia (padrão repetido).";
  for (const p of datasProibidas(nascimento)) {
    if (p.length >= 6 && senha.includes(p)) return "A senha não pode ser a sua data de nascimento.";
  }
  return null;
}

// ---------- Cadastro ----------

export interface DadosCadastro {
  cpf: string;
  senha: string;
  nome: string;
  nomesCitacao: string[];
  orcid?: string | null;
  lattesId?: string | null;
  email?: string | null;
  dataNascimento: string;
  consentimento: boolean;
}

function gerarCodigoRecuperacao(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  let c = "";
  for (let i = 0; i < 12; i++) c += alfabeto[bytes[i] % alfabeto.length];
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

/** Cria a conta do autor principal. Devolve o código de recuperação (mostrado uma única vez). */
export async function cadastrarAutor(d: DadosCadastro): Promise<{ id: number; codigoRecuperacao: string }> {
  if (!cpfValido(d.cpf)) throw new ErroAcesso("CPF inválido.");
  if (!d.dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(d.dataNascimento))
    throw new ErroAcesso("Informe a data de nascimento.");
  const prob = problemaNaSenha(d.senha, d.dataNascimento);
  if (prob) throw new ErroAcesso(prob);
  if (!d.nome?.trim()) throw new ErroAcesso("Informe o nome completo.");
  if (!d.consentimento) throw new ErroAcesso("É preciso aceitar o termo de consentimento (LGPD).");
  const h = cpfHmac(d.cpf);
  if (um("SELECT id FROM usuario WHERE cpf_hmac = ?", h)) throw new ErroAcesso("Já existe uma conta com este CPF.");

  const nomes = d.nomesCitacao.map((n) => n.trim()).filter(Boolean);
  if (!nomes.length) nomes.push(nomeEmCitacao(d.nome));
  const senhaHash = await hash(d.senha);
  const codigo = gerarCodigoRecuperacao();
  const codigoHash = await hash(codigo.replace(/-/g, ""));

  const id = transacao(() => {
    const id = inserir("usuario", {
      perfil: "autor",
      cpf_hmac: h,
      cpf_mascara: mascararCpf(d.cpf),
      senha_hash: senhaHash,
      nome: d.nome.trim(),
      nomes_citacao: JSON.stringify(nomes),
      orcid: normalizarOrcid(d.orcid),
      lattes_id: d.lattesId?.trim() || null,
      email: d.email?.trim() || null,
      data_nascimento: d.dataNascimento,
      consentimento_em: agora(),
      recuperacao_hash: codigoHash,
    });
    criarTiposPadrao(id);
    registrarAcesso(id, mascararCpf(d.cpf), "cadastro");
    return id;
  });
  return { id, codigoRecuperacao: codigo };
}

export async function criarLeitor(
  autorId: number,
  d: { cpf: string; senha: string; nome: string; email?: string | null },
): Promise<number> {
  if (!cpfValido(d.cpf)) throw new ErroAcesso("CPF inválido.");
  const prob = problemaNaSenha(d.senha);
  if (prob) throw new ErroAcesso(prob);
  if (!d.nome?.trim()) throw new ErroAcesso("Informe o nome do leitor.");
  const h = cpfHmac(d.cpf);
  if (um("SELECT id FROM usuario WHERE cpf_hmac = ?", h)) throw new ErroAcesso("Já existe uma conta com este CPF.");
  return inserir("usuario", {
    perfil: "leitor",
    dono_id: autorId,
    cpf_hmac: h,
    cpf_mascara: mascararCpf(d.cpf),
    senha_hash: await hash(d.senha),
    nome: d.nome.trim(),
    email: d.email?.trim() || null,
    consentimento_em: null,
  });
}

// ---------- Entrar / sessões ----------

export function registrarAcesso(usuarioId: number | null, cpfMascara: string | null, evento: string, detalhe?: string) {
  executar(
    "INSERT INTO log_acesso (usuario_id, cpf_mascara, evento, detalhe) VALUES (?, ?, ?, ?)",
    usuarioId,
    cpfMascara,
    evento,
    detalhe ?? null,
  );
}

interface LinhaLogin {
  id: number;
  senha_hash: string;
  falhas_seguidas: number;
  bloqueado_ate: string | null;
  cpf_mascara: string;
  ativo: number;
}

export async function entrar(cpf: string, senha: string): Promise<{ token: string; usuarioId: number }> {
  if (!cpfValido(cpf)) throw new ErroAcesso("CPF inválido.");
  const u = um<LinhaLogin>(
    "SELECT id, senha_hash, falhas_seguidas, bloqueado_ate, cpf_mascara, ativo FROM usuario WHERE cpf_hmac = ?",
    cpfHmac(cpf),
  );
  const generico = "CPF ou senha incorretos.";
  if (!u || !u.ativo) {
    registrarAcesso(null, mascararCpf(cpf), "login_falhou", "conta inexistente");
    throw new ErroAcesso(generico);
  }
  if (u.bloqueado_ate && u.bloqueado_ate > agora()) {
    registrarAcesso(u.id, u.cpf_mascara, "login_bloqueado");
    throw new ErroAcesso(
      `Acesso bloqueado temporariamente após ${MAX_TENTATIVAS} erros. Tente de novo em alguns minutos ou recupere a senha.`,
    );
  }
  const ok = await verify(u.senha_hash, senha).catch(() => false);
  if (!ok) {
    const falhas = u.falhas_seguidas + 1;
    if (falhas >= MAX_TENTATIVAS) {
      executar(
        "UPDATE usuario SET falhas_seguidas = 0, bloqueado_ate = ? WHERE id = ?",
        maisMinutos(MINUTOS_BLOQUEIO),
        u.id,
      );
      registrarAcesso(u.id, u.cpf_mascara, "bloqueio", `${falhas} erros seguidos`);
      throw new ErroAcesso(
        `Senha incorreta ${MAX_TENTATIVAS} vezes seguidas. Acesso bloqueado por ${MINUTOS_BLOQUEIO} minutos.`,
      );
    }
    executar("UPDATE usuario SET falhas_seguidas = ? WHERE id = ?", falhas, u.id);
    registrarAcesso(u.id, u.cpf_mascara, "login_falhou");
    throw new ErroAcesso(`${generico} (${MAX_TENTATIVAS - falhas} tentativa(s) antes do bloqueio)`);
  }
  executar("UPDATE usuario SET falhas_seguidas = 0, bloqueado_ate = NULL WHERE id = ?", u.id);
  const token = crypto.randomBytes(32).toString("base64url");
  inserir("sessao", { usuario_id: u.id, token_hash: sha256(token) });
  registrarAcesso(u.id, u.cpf_mascara, "login");
  return { token, usuarioId: u.id };
}

const CAMPOS_USUARIO =
  "u.id, u.dono_id, u.perfil, u.cpf_mascara, u.nome, u.nomes_citacao, u.orcid, u.lattes_id, u.email, u.data_nascimento, u.area_qualis_ref, u.dias_sem_movimentacao, u.consentimento_em";

/** Valida o token e renova o prazo. Sessão parada há mais de 30 minutos expira. */
export function usuarioDaSessao(token: string | undefined | null): Usuario | null {
  if (!token) return null;
  const s = um<{ id: number; ultimo_uso: string; encerrada: number } & Usuario>(
    `SELECT s.id AS sessao_id, s.ultimo_uso, s.encerrada, ${CAMPOS_USUARIO}
       FROM sessao s JOIN usuario u ON u.id = s.usuario_id
      WHERE s.token_hash = ? AND u.ativo = 1`,
    sha256(token),
  ) as (Usuario & { sessao_id: number; ultimo_uso: string; encerrada: number }) | undefined;
  if (!s || s.encerrada) return null;
  const limite = new Date(Date.now() - MINUTOS_SESSAO * 60000).toISOString().replace("T", " ").slice(0, 19);
  if (s.ultimo_uso < limite) {
    executar("UPDATE sessao SET encerrada = 1 WHERE id = ?", s.sessao_id);
    return null;
  }
  executar("UPDATE sessao SET ultimo_uso = ? WHERE id = ?", agora(), s.sessao_id);
  const { sessao_id: _a, ultimo_uso: _b, encerrada: _c, ...u } = s;
  return u;
}

export function sair(token: string) {
  executar("UPDATE sessao SET encerrada = 1 WHERE token_hash = ?", sha256(token));
}

export function encerrarTodasAsSessoes(usuarioId: number) {
  executar("UPDATE sessao SET encerrada = 1 WHERE usuario_id = ?", usuarioId);
  registrarAcesso(usuarioId, null, "encerrou_todas_sessoes");
}

export function buscarUsuario(id: number): Usuario | undefined {
  return um<Usuario>(`SELECT ${CAMPOS_USUARIO} FROM usuario u WHERE u.id = ?`, id);
}

export function nomesCitacaoDe(u: Pick<Usuario, "nomes_citacao" | "nome">): string[] {
  try {
    const l = JSON.parse(u.nomes_citacao) as string[];
    return l.length ? l : [nomeEmCitacao(u.nome)];
  } catch {
    return [nomeEmCitacao(u.nome)];
  }
}

// ---------- Senha: troca e recuperação ----------

async function gravarNovaSenha(usuarioId: number, nova: string, nascimento: string | null) {
  const prob = problemaNaSenha(nova, nascimento);
  if (prob) throw new ErroAcesso(prob);
  executar(
    "UPDATE usuario SET senha_hash = ?, falhas_seguidas = 0, bloqueado_ate = NULL, recuperacao_email_hash = NULL WHERE id = ?",
    await hash(nova),
    usuarioId,
  );
  encerrarTodasAsSessoes(usuarioId);
}

export async function trocarSenha(usuarioId: number, atual: string, nova: string) {
  const u = um<{ senha_hash: string; data_nascimento: string | null }>(
    "SELECT senha_hash, data_nascimento FROM usuario WHERE id = ?",
    usuarioId,
  );
  if (!u || !(await verify(u.senha_hash, atual).catch(() => false))) throw new ErroAcesso("Senha atual incorreta.");
  await gravarNovaSenha(usuarioId, nova, u.data_nascimento);
  registrarAcesso(usuarioId, null, "troca_senha");
}

/** Recuperação pelo código mostrado no cadastro. Devolve um código novo (o antigo deixa de valer). */
export async function recuperarComCodigo(cpf: string, codigo: string, nova: string): Promise<string> {
  const u = um<{ id: number; recuperacao_hash: string | null; data_nascimento: string | null; cpf_mascara: string }>(
    "SELECT id, recuperacao_hash, data_nascimento, cpf_mascara FROM usuario WHERE cpf_hmac = ?",
    cpfHmac(cpf),
  );
  const limpo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!u?.recuperacao_hash || !(await verify(u.recuperacao_hash, limpo).catch(() => false))) {
    registrarAcesso(u?.id ?? null, mascararCpf(cpf), "recuperacao_falhou");
    throw new ErroAcesso("CPF ou código de recuperação incorretos.");
  }
  await gravarNovaSenha(u.id, nova, u.data_nascimento);
  const novoCodigo = gerarCodigoRecuperacao();
  executar("UPDATE usuario SET recuperacao_hash = ? WHERE id = ?", await hash(novoCodigo.replace(/-/g, "")), u.id);
  registrarAcesso(u.id, u.cpf_mascara, "recuperacao_codigo");
  return novoCodigo;
}

/** Gera um código de 6 dígitos válido por 15 minutos, para enviar ao e-mail cadastrado. */
export async function gerarCodigoEmail(cpf: string): Promise<{ email: string; codigo: string } | null> {
  if (!cpfValido(cpf)) return null;
  const u = um<{ id: number; email: string | null }>("SELECT id, email FROM usuario WHERE cpf_hmac = ?", cpfHmac(cpf));
  if (!u?.email) return null;
  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  executar(
    "UPDATE usuario SET recuperacao_email_hash = ?, recuperacao_email_expira = ? WHERE id = ?",
    sha256(codigo),
    maisMinutos(15),
    u.id,
  );
  return { email: u.email, codigo };
}

export async function recuperarComCodigoEmail(cpf: string, codigo: string, nova: string) {
  const u = um<{
    id: number;
    recuperacao_email_hash: string | null;
    recuperacao_email_expira: string | null;
    data_nascimento: string | null;
  }>(
    "SELECT id, recuperacao_email_hash, recuperacao_email_expira, data_nascimento FROM usuario WHERE cpf_hmac = ?",
    cpfHmac(cpf),
  );
  if (
    !u?.recuperacao_email_hash ||
    !u.recuperacao_email_expira ||
    u.recuperacao_email_expira < agora() ||
    u.recuperacao_email_hash !== sha256(codigo.trim())
  ) {
    throw new ErroAcesso("Código inválido ou expirado.");
  }
  await gravarNovaSenha(u.id, nova, u.data_nascimento);
  registrarAcesso(u.id, null, "recuperacao_email");
}

export function existeAlgumAutor(): boolean {
  return !!um("SELECT 1 FROM usuario WHERE perfil = 'autor' LIMIT 1");
}

export function leitoresDe(autorId: number) {
  return todos<{ id: number; nome: string; cpf_mascara: string; email: string | null; ativo: number }>(
    "SELECT id, nome, cpf_mascara, email, ativo FROM usuario WHERE dono_id = ? AND perfil = 'leitor' ORDER BY nome",
    autorId,
  );
}
