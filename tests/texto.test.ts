import { describe, expect, it } from "vitest";
import { chaveNome, cpfValido, issnValido, mascararCpf, normalizar, normalizarDoi, quadrienio, similaridade } from "@/lib/texto";

describe("texto", () => {
  it("normaliza DOI em qualquer formato", () => {
    expect(normalizarDoi("https://doi.org/10.1590/ABC.123")).toBe("10.1590/abc.123");
    expect(normalizarDoi("doi.org/10.1590/abc")).toBe("10.1590/abc");
    expect(normalizarDoi("doi: 10.1590/abc.")).toBe("10.1590/abc");
    expect(normalizarDoi("10.1590%2Fabc")).toBe("10.1590/abc");
    expect(normalizarDoi("abc")).toBeNull();
  });
  it("valida CPF e mascara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-26")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(mascararCpf("52998224725")).toBe("***.982.247-**");
  });
  it("normaliza títulos e mede similaridade", () => {
    expect(normalizar("Revisão: Integrativa!")).toBe("revisao integrativa");
    expect(similaridade("Cuidados de enfermagem na sepse", "Cuidados de Enfermagem na Sépse.")).toBe(1);
    expect(similaridade("abc", "xyz")).toBeLessThan(0.5);
  });
  it("gera a mesma chave para grafias diferentes", () => {
    expect(chaveNome("SCHIAVÃO, L.")).toBe(chaveNome("Schiavao, L"));
    expect(chaveNome("Luana Schiavão")).toBe("schiavao l");
  });
  it("valida ISSN e quadriênio", () => {
    expect(issnValido("0102-6933")).toBe(true);
    expect(issnValido("0102-6934")).toBe(false);
    expect(quadrienio(2022)).toBe("2021-2024");
    expect(quadrienio(2019)).toBe("2017-2020");
  });
});

import { numeroBr } from "@/lib/texto";
describe("valores no formato brasileiro", () => {
  it("entende ponto de milhar e vírgula de centavos", () => {
    expect(numeroBr("1.200")).toBe(1200);
    expect(numeroBr("1.200,50")).toBe(1200.5);
    expect(numeroBr("980,00")).toBe(980);
    expect(numeroBr("R$ 35")).toBe(35);
    expect(numeroBr("0")).toBe(0);
    expect(numeroBr("12.5")).toBe(12.5);
    expect(numeroBr("")).toBeNull();
    expect(numeroBr("abc")).toBeNull();
  });
});
