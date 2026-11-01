"use client";
import { formatarCpf } from "@/lib/texto";

export function CampoCpf({ valor, mudar, id = "cpf" }: { valor: string; mudar: (v: string) => void; id?: string }) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="username"
      placeholder="000.000.000-00"
      value={valor}
      maxLength={14}
      onChange={(e) => mudar(formatarCpf(e.target.value))}
      required
    />
  );
}

export function CampoSenha({ valor, mudar, id = "senha", novo = false }: { valor: string; mudar: (v: string) => void; id?: string; novo?: boolean }) {
  return (
    <input
      id={id}
      type="password"
      inputMode="numeric"
      autoComplete={novo ? "new-password" : "current-password"}
      pattern="[0-9]{6,8}"
      maxLength={8}
      value={valor}
      onChange={(e) => mudar(e.target.value.replace(/\D/g, ""))}
      required
    />
  );
}
