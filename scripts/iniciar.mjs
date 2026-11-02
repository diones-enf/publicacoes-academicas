// Liga o sistema. Antes, faz sozinho o que for preciso:
// 1) desliga uma versão que já esteja aberta; 2) instala dependências novas;
// 3) prepara (build) a versão nova depois de uma atualização; 4) abre o navegador.
import { execSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(raiz);
const PORTA = 3000;
const win = process.platform === "win32";
const versao = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const hash = (f) => (fs.existsSync(f) ? crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex") : "");
const ler = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim() : "");
const aviso = (t) => console.log(`\n  ${t}\n`);

// 1. Desliga versão antiga que esteja usando a porta
if (win) {
  try {
    const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
    const pids = new Set(
      out
        .split(/\r?\n/)
        .filter((l) => l.includes(`:${PORTA} `) && /LISTEN/i.test(l))
        .map((l) => l.trim().split(/\s+/).pop())
        .filter((p) => p && p !== "0" && p !== String(process.pid)),
    );
    for (const pid of pids) {
      aviso("Desligando a versão do sistema que já estava aberta...");
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    }
  } catch {
    /* nada aberto */
  }
}

// 2. Dependências (só quando mudam)
const lock = hash("package-lock.json");
const marcaDep = path.join("node_modules", ".instalado-publicacoes");
if (!fs.existsSync("node_modules") || ler(marcaDep) !== lock) {
  aviso("Instalando componentes do sistema (1 a 3 minutos, só desta vez)...");
  execSync("npm install --no-audit --no-fund", { stdio: "inherit", shell: true });
  fs.writeFileSync(marcaDep, lock);
}

// 3. Preparar a versão (só depois de uma atualização)
const marcaBuild = path.join(".next", "versao-preparada.txt");
const assinatura = `${versao}|${lock}`;
if (ler(marcaBuild) !== assinatura) {
  aviso(`Preparando a versão ${versao} do sistema (cerca de 1 minuto, só desta vez)...`);
  execSync(`"${process.execPath}" node_modules/next/dist/bin/next build`, { stdio: "inherit", shell: true });
  fs.writeFileSync(marcaBuild, assinatura);
}

// 4. Liga e abre o navegador quando estiver pronto
aviso(`Sistema ligado (versão ${versao}). Endereço: http://localhost:${PORTA}\n  Deixe esta janela aberta enquanto usa o sistema.`);
const servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(PORTA)], {
  stdio: "inherit",
});
if (process.env.NAO_ABRIR_NAVEGADOR !== "1") {
  const inicio = Date.now();
  const tentar = () =>
    fetch(`http://127.0.0.1:${PORTA}/entrar`)
      .then(() => {
        const url = `http://localhost:${PORTA}`;
        if (win) spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
        else if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore", detached: true });
      })
      .catch(() => Date.now() - inicio < 60000 && setTimeout(tentar, 700));
  setTimeout(tentar, 700);
}
servidor.on("exit", (c) => process.exit(c ?? 0));
