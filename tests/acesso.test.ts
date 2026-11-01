import { describe, expect, it } from "vitest";
import "./apoio";
import { novoAmbiente } from "./apoio";
import { cadastrarAutor, entrar, ErroAcesso, problemaNaSenha, usuarioDaSessao, encerrarTodasAsSessoes, recuperarComCodigo } from "@/lib/auth";
import { executar, um, usarBancoEmMemoria } from "@/lib/db";

const base = { nome: "Teste", nomesCitacao: [], dataNascimento: "1990-01-31", consentimento: true };

describe("Critério 6: CPF inválido e senha com letras são recusados", () => {
  it("recusa CPF inválido", async () => {
    await novoAmbiente();
    await expect(cadastrarAutor({ ...base, cpf: "123.456.789-00", senha: "839201" })).rejects.toThrow("CPF inválido");
  });
  it("recusa senha com letras, curta, óbvia ou igual à data de nascimento", async () => {
    await novoAmbiente();
    await expect(cadastrarAutor({ ...base, cpf: "111.444.777-35", senha: "abc123" })).rejects.toThrow("somente números");
    expect(problemaNaSenha("12345")).toMatch(/6 a 8/);
    expect(problemaNaSenha("123456")).toMatch(/óbvia/);
    expect(problemaNaSenha("000000")).toMatch(/óbvia/);
    expect(problemaNaSenha("654321")).toMatch(/óbvia/);
    expect(problemaNaSenha("31011990", "1990-01-31")).toMatch(/nascimento/);
    expect(problemaNaSenha("839201", "1990-01-31")).toBeNull();
  });
  it("não grava o CPF, só o hash e a máscara", async () => {
    await novoAmbiente();
    const u = um<Record<string, string>>("SELECT * FROM usuario LIMIT 1")!;
    expect(JSON.stringify(u)).not.toContain("52998224725");
    expect(u.cpf_mascara).toBe("***.982.247-**");
    expect(u.senha_hash).toMatch(/^\$argon2id\$/);
  });
});

describe("login, bloqueio e sessão", () => {
  it("bloqueia após 5 erros seguidos", async () => {
    await novoAmbiente();
    for (let i = 0; i < 4; i++) await expect(entrar("529.982.247-25", "000001")).rejects.toBeInstanceOf(ErroAcesso);
    await expect(entrar("529.982.247-25", "000001")).rejects.toThrow("bloqueado");
    await expect(entrar("529.982.247-25", "839201")).rejects.toThrow("bloqueado");
  });
  it("sessão expira após 30 minutos sem uso e pode ser encerrada", async () => {
    const ctx = await novoAmbiente();
    const { token } = await entrar("52998224725", "839201");
    expect(usuarioDaSessao(token)?.nome).toBe("Daniela Rodrigues Rosa");
    executar("UPDATE sessao SET ultimo_uso = datetime('now', '-31 minutes')");
    expect(usuarioDaSessao(token)).toBeNull();
    const s2 = await entrar("52998224725", "839201");
    encerrarTodasAsSessoes(ctx.donoId);
    expect(usuarioDaSessao(s2.token)).toBeNull();
  });
  it("recupera a senha com o código de recuperação", async () => {
    usarBancoEmMemoria();
    const { codigoRecuperacao } = await cadastrarAutor({ ...base, cpf: "111.444.777-35", senha: "839201" });
    await expect(recuperarComCodigo("11144477735", "AAAA-BBBB-CCCC", "750913")).rejects.toThrow();
    const novo = await recuperarComCodigo("11144477735", codigoRecuperacao.toLowerCase(), "750913");
    expect(novo).not.toBe(codigoRecuperacao);
    await expect(entrar("11144477735", "750913")).resolves.toHaveProperty("token");
  });
});
