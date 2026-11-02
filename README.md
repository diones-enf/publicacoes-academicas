# Publicações Acadêmicas

Sistema pessoal para controlar a produção acadêmica: publicações, submissões,
custos, métricas das revistas, coautores e relatórios. Roda **só no seu
notebook**: os dados ficam num arquivo dentro da pasta do sistema e nada vai
para a internet, a não ser as buscas em bases públicas (Crossref, OpenAlex,
ORCID, DataCite e Banco Central).

Situação: **Fase 1 entregue** (veja [CHECKLIST.md](CHECKLIST.md) para o que já
foi feito e o que fica para as fases 2 e 3).

---

## Jeito mais fácil (Windows)

1. Baixe o sistema: https://github.com/diones-enf/publicacoes-academicas/archive/refs/heads/main.zip
   e descompacte (botão direito → Extrair tudo).
2. Dentro da pasta, dê **dois cliques em `INICIAR.bat`** (pode aparecer só como `INICIAR`).
   - Se o Node.js não estiver instalado, ele abre a página de download: instale a versão LTS e clique em INICIAR de novo.
   - Na primeira vez ele demora alguns minutos preparando tudo.
3. O navegador abre sozinho em http://localhost:3000. Deixe a janela preta aberta enquanto usa.

Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo**.

Ao baixar uma versão nova do sistema, copie a pasta `dados` da versão antiga para a nova (é onde ficam suas informações).

---

## Instalação manual (uma vez só)

### 1. Instale o Node.js

1. Acesse https://nodejs.org e baixe a versão **LTS** (22 ou mais nova).
2. Instale com as opções padrão (Avançar, Avançar, Concluir).
3. Para conferir, abra o **Prompt de Comando** (Windows: tecla Windows, digite
   `cmd`, Enter) ou o **Terminal** (Mac) e digite:

```bash
node -v
```

Deve aparecer `v22...` ou mais novo.

### 2. Baixe o sistema

No GitHub, clique no botão verde **Code → Download ZIP**, descompacte numa
pasta fácil, por exemplo `Documentos\publicacoes-academicas`.

(Se você usa Git: `git clone` do repositório.)

### 3. Instale as dependências

No Prompt de Comando/Terminal, entre na pasta e rode:

```bash
cd Documentos\publicacoes-academicas
```

```bash
npm install
```

Leva um ou dois minutos.

---

## Uso no dia a dia

Na pasta do sistema, rode:

```bash
npm run iniciar
```

Quando aparecer `Ready`, abra no navegador: **http://localhost:3000**

- No primeiro acesso, o sistema pede o cadastro (CPF, senha numérica, nome,
  nomes em citação, ORCID, Lattes, e-mail, data de nascimento) e mostra um
  **código de recuperação**. Anote-o: é ele que permite trocar a senha se você
  esquecer.
- No painel, use **"carregue dados de exemplo"** para ver o sistema funcionando
  com dados fictícios. Depois apague-os pelo aviso amarelo do painel.
- Para fechar o sistema, feche a janela do Prompt/Terminal (ou `Ctrl+C`).

Dica: depois da primeira vez, `npm start` abre mais rápido (só use
`npm run iniciar` de novo quando atualizar o sistema).

O sistema só aceita conexões do próprio notebook (endereço 127.0.0.1): ninguém
na mesma rede Wi-Fi consegue acessá-lo.

---

## Onde ficam os dados

Na pasta `dados/`, dentro da pasta do sistema:

| Arquivo | O que é |
|---|---|
| `dados/publicacoes.db` | O banco de dados (tudo o que você cadastrou) |
| `dados/backups/` | Cópia automática diária dos últimos 30 dias |
| `dados/chave-secreta.txt` | Chave que protege o CPF. **Não apague**: sem ela o login para de funcionar |

**Backup fora do notebook (recomendado):** crie um arquivo `.env` na pasta do
sistema (copie o `.env.example`) e preencha `PASTA_BACKUP_EXTRA` com uma pasta
do OneDrive ou do Google Drive. O backup diário passa a ser copiado para lá.
Em **Configurações** também há "Exportar tudo" em JSON e XLSX.

**Trocar de computador:** copie a pasta `dados/` inteira para a pasta do
sistema no computador novo.

---

## Configurações opcionais (arquivo `.env`)

Copie `.env.example` para `.env` e preencha só o que quiser:

- `PASTA_BACKUP_EXTRA` — cópia do backup diário para outra pasta.
- `EMAIL_CONTATO_APIS` — seu e-mail, enviado ao Crossref/OpenAlex (eles pedem
  isso por educação e respondem mais rápido).
- `SMTP_...` — envio de e-mail para lembretes e recuperação de senha. Com
  Gmail, use uma "senha de app" (Conta Google → Segurança → Senhas de app).
  Sem isso, os lembretes aparecem só no painel e a recuperação usa o código.

---

## Como foi feito (para quem for mexer no código)

- **Next.js 16 + React 19 + TypeScript**: telas e API REST (`src/app/api`) no
  mesmo projeto.
- **SQLite nativo do Node** (`node:sqlite`): banco num único arquivo, sem
  instalar servidor de banco. O PostgreSQL sugerido no prompt foi trocado por
  ele porque o sistema roda só num notebook; a estrutura (`src/lib/schema.ts`)
  é relacional e migraria para PostgreSQL sem mudar o modelo.
- **Senhas** com argon2id; **CPF** guardado só como HMAC + versão mascarada.
- **Conectores** em `src/lib/conectores/` (um arquivo por fonte, mesmo formato
  de saída). Para incluir uma fonte nova, basta criar outro arquivo.
- **Regras de negócio** em `src/lib/` (sem dependência das telas), cobertas
  pelos testes em `tests/`.

Comandos:

```bash
npm test
```

```bash
npm run typecheck
```

Os testes cobrem os critérios de aceite da Fase 1 (CPF/senha, mescla por DOI
sem apagar dados manuais, taxa R$ 0, soma por competência com USD/EUR, fusão de
coautores, JIF atualizando todos os artigos, preenchimento por DOI em menos de
5 s, busca por autor marcando os já cadastrados, Publicado/desfazer,
lembretes 7 e 2 dias antes), com respostas das APIs simuladas.

## Limitações conhecidas

- **Buscas dependem de internet.** Sem conexão, o cadastro abre em branco
  normalmente.
- **Lattes, Sucupira (Qualis) e JCR não têm API pública aberta.** A importação
  desses arquivos chega na Fase 2; por enquanto as métricas são digitadas na
  tela da revista, com selo de confiança.
- **ISBN Brasil** não tem API pública; livros são buscados no Crossref e na
  Open Library.
- O PDF dos relatórios é gerado pelo botão "PDF / Imprimir" do navegador
  (escolha "Salvar como PDF").
