// Atalho na área de trabalho do Windows, com o ícone do sistema.
// Se já existir um atalho que abre o INICIAR.bat, ele é atualizado (qualquer nome);
// se não existir, cria "Publicações Acadêmicas".
import { execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

function aspas(t: string) {
  return `'${t.replace(/'/g, "''")}'`;
}

export function scriptAtalho(pasta: string): string {
  const alvo = path.join(pasta, "INICIAR.bat");
  const icone = path.join(pasta, "icone.ico");
  return [
    "$ErrorActionPreference = 'Stop'",
    "$sh = New-Object -ComObject WScript.Shell",
    `$alvo = ${aspas(alvo)}`,
    `$icone = ${aspas(icone)}`,
    `$pasta = ${aspas(pasta)}`,
    "$mesa = [Environment]::GetFolderPath('Desktop')",
    "$feitos = @()",
    "Get-ChildItem -LiteralPath $mesa -Filter *.lnk | ForEach-Object {",
    "  $l = $sh.CreateShortcut($_.FullName)",
    "  if ($l.TargetPath -like '*INICIAR.bat') { $l.TargetPath = $alvo; $l.WorkingDirectory = $pasta; $l.IconLocation = \"$icone,0\"; $l.WindowStyle = 7; $l.Save(); $feitos += 'atualizado' }",
    "}",
    "if ($feitos.Count -eq 0) {",
    "  $l = $sh.CreateShortcut((Join-Path $mesa 'Publicações Acadêmicas.lnk'))",
    "  $l.TargetPath = $alvo; $l.WorkingDirectory = $pasta; $l.IconLocation = \"$icone,0\"; $l.WindowStyle = 7",
    "  $l.Description = 'Abrir o sistema Publicações Acadêmicas'; $l.Save(); $feitos += 'criado'",
    "}",
    "Write-Output ($feitos -join '|')",
  ].join("\n");
}

export function criarAtalho(pasta = process.cwd()): Promise<{ criado: boolean; atualizados: number }> {
  if (process.platform !== "win32") return Promise.reject(new Error("O atalho só pode ser criado no Windows."));
  if (!fs.existsSync(path.join(pasta, "icone.ico"))) return Promise.reject(new Error("Arquivo do ícone não encontrado. Atualize o sistema primeiro."));
  const codificado = Buffer.from(scriptAtalho(pasta), "utf16le").toString("base64");
  return new Promise((ok, falha) =>
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codificado], { timeout: 30000, windowsHide: true }, (erro, saida, err) => {
      if (erro) return falha(new Error(`Não consegui criar o atalho: ${(err || erro.message).toString().trim().slice(0, 300)}`));
      const l = saida.trim().split("|");
      ok({ criado: l.includes("criado"), atualizados: l.filter((x) => x === "atualizado").length });
    }),
  );
}
