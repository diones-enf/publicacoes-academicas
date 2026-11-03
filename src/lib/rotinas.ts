// Rotinas automáticas. O sistema roda no notebook, então elas são
// disparadas na primeira vez que o sistema é usado em cada dia.
import { metaGravar, metaLer, todos } from "./db";
import { fazerBackup } from "./backup";
import { enviarLembretesPorEmail, gerarLembretes } from "./lembretes";
import { hojeIso } from "./texto";
import { atualizarCitacoes } from "./citacoes";

let rodando = false;

export function executarRotinasDoDia(forcar = false) {
  const hoje = hojeIso();
  if (rodando || (!forcar && metaLer("ultima_rotina_diaria") === hoje)) return;
  rodando = true;
  try {
    metaGravar("ultima_rotina_diaria", hoje);
    try {
      fazerBackup();
      metaGravar("ultimo_backup", new Date().toISOString());
    } catch (e) {
      console.error("Backup diário falhou:", (e as Error).message);
    }
    const novoMes = metaLer("citacoes_mes") !== hoje.slice(0, 7);
    if (novoMes) metaGravar("citacoes_mes", hoje.slice(0, 7));
    for (const { id } of todos<{ id: number }>("SELECT id FROM usuario WHERE perfil = 'autor' AND ativo = 1")) {
      gerarLembretes(id, hoje);
      void enviarLembretesPorEmail(id);
      // Foto mensal das citações (em segundo plano; sem internet, tenta no mês seguinte ou pelo botão)
      if (novoMes) void atualizarCitacoes(id).catch(() => undefined);
    }
  } finally {
    rodando = false;
  }
}
