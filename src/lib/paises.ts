// Nome dos países a partir do código de duas letras (ISO), em português.
const nomes = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["pt-BR"], { type: "region" }) : null;

export function nomePais(codigo: string): string {
  if (!/^[A-Z]{2}$/.test(codigo)) return codigo;
  try {
    return nomes?.of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}
