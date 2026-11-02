# Lista de verificação do prompt

Cada item do documento "Prompt — Sistema de Controle de Publicações
Acadêmicas" e sua situação. Legenda: ✅ feito · 🟡 parcial (o que falta está
descrito) · ⏳ fase seguinte · ↔ adaptado (motivo ao lado).

## Decisões combinadas antes de começar

- ↔ Uso só no notebook: SQLite local em vez de PostgreSQL na nuvem; arquivos (fase 2) numa pasta local.
- ↔ Sem verificação em duas etapas (pedido seu).
- ✅ Data de nascimento obrigatória no cadastro (para recusar senha igual a ela).

## 1. Objetivo

- ✅ Registro único por publicação, com fonte e data de cada dado importado.
- ✅ Interface e relatórios em português, datas DD/MM/AAAA, valores em R$.

## 2. Acesso e segurança

- ✅ CPF com máscara e validação dos dígitos; gravado só como hash; exibido mascarado (***.456.789-**).
- ✅ Senha só números, 6 a 8 dígitos; recusa sequências, repetições e data de nascimento; argon2id.
- ✅ Bloqueio temporário (15 min) após 5 erros seguidos.
- 🟡 Recuperação de senha: código de recuperação (sempre) + código por e-mail quando o SMTP estiver configurado no `.env`.
- ✅ Sessão expira após 30 min sem uso; botão "Encerrar todas as sessões".
- ✅ Perfis: autor principal e leitor convidado (só relatórios, sem ver o CPF).
- ✅ Cadastro inicial: nome, nomes em citação, ORCID, Lattes, e-mail.

## 3. Modelo de dados

- ✅ Publicação, Autoria, Coautor, Veículo, Métrica do veículo, Indexação, Lançamento de custo, Evento, Histórico.
- ✅ Histórico de status (com prazos e lembretes).
- ⏳ Anexo (fase 2), Atividade acadêmica e Registro mensal de citações (fase 3).
- ✅ Rastreabilidade: cada campo importado guarda fonte e data; divergências entre fontes aparecem lado a lado.
- ✅ Métricas pertencem ao veículo (atualizar o JIF atualiza todos os artigos).
- ✅ Qualis por área; você escolhe a área de referência.

## 4. Tipos e subtipos

- ✅ Os 8 tipos e todos os subtipos do prompt, editáveis em Configurações.
- ✅ O tipo define os campos do formulário e o relatório onde o item entra.
- ✅ Status comuns com data de cada mudança.
- ✅ Versões relacionadas (mesmo trabalho em anais e em artigo).

## 5. Importação e deduplicação

- ⏳ Importação de Lattes XML, ORCID em lote, Sucupira, Scopus, WoS/JCR, DOAJ/SciELO/PubMed/LILACS, planilha própria (fase 2).
- ✅ Regras de duplicidade: mesmo DOI normalizado; ISBN + título; título ≥ 90% + ano → "possível duplicata" com mesclar / manter os dois / ligar como versões.
- ✅ Mescla nunca sobrescreve o que foi digitado à mão.
- ⏳ Prévia obrigatória e desfazer importação inteira (fase 2, junto com as importações).
- ⏳ Passo a passo na tela para baixar arquivos do Lattes, Sucupira e JCR (fase 2).
- ✅ Reconhecimento do autor principal pelos nomes em citação e ORCID, com ordem e papel.

### Cadastro manual com preenchimento automático

- ✅ Busca por DOI em qualquer formato (Crossref → OpenAlex e DataCite).
- ✅ Busca por nome ou ORCID do autor (ORCID, OpenAlex, Crossref), marcando os já cadastrados.
- ✅ Busca por título.
- ✅ Um clique abre o formulário preenchido, com a fonte marcada em cada campo.
- 🟡 Complementos pelo ISSN: o Qualis/JCR/Scopus/indexações já cadastrados da revista aparecem automaticamente; a busca nas fontes oficiais chega com as importações da fase 2.
- ✅ Taxas, competência, subtipo e status ficam para o usuário; subtipo sugerido pelo título/resumo, com confirmação.
- ✅ Aviso de DOI/título já existente antes de abrir o formulário.
- ✅ Sem resultado: formulário em branco.
- ✅ ISBN para livros e capítulos (Crossref e Open Library). ↔ ISBN Brasil não tem API pública.

### Cadastro pelo PDF

- ⏳ Fase 2 (envio, leitura, OCR, DOI primeiro, confiança por campo, certificados).

## 6. Conferência de JCR, Qualis e indexações

- ✅ Selos "Confirmado na fonte oficial", "Informado pela revista", "Informado pelo usuário", "Não localizado", com data.
- ✅ Campos completos do JCR (JIF, JIF 5 anos, JCI, quartil, posição, categoria, coleção), Scopus (SJR, CiteScore, quartil) e Qualis (quadriênio, estrato, área).
- ✅ Avisos: "estar no WoS ≠ ter JCR", ESCI só com JIF a partir do JCR 2023.
- ✅ Alertas: ISSN inválido, indexação interrompida, métricas há mais de 12 meses sem conferência.
- ✅ Busca automática pelo ISSN: Scopus (SJR e quartil, via SCImago), DOAJ, PubMed/MEDLINE e SciELO; Qualis e JCR pelas planilhas oficiais importadas (tela Revistas → Importar Qualis e JCR), aplicadas a todas as revistas.
- ⏳ Aviso de nova lista Qualis, aviso de nova lista Qualis, mudança de editora, lista de predatórias, "Reconferir todos" e rotina mensal (fase 2). Hoje há o botão "Marquei tudo como conferido hoje" por revista.
- 🟡 Validação de DOI: formato validado e "Completar campos vazios pelo DOI" mostra divergências com o Crossref; o alerta de "DOI que não resolve" vem com a rotina mensal.

## 7. Custos e taxas

- ✅ Taxa de submissão e APC obrigatórias; R$ 0,00 = gratuito; vazio só com "Ainda não sei".
- ✅ Outros custos (inscrição, tradução, revisão, formatação, DOI, ISBN, impressão, viagem, outros com descrição).
- ✅ Valor, moeda (BRL/USD/EUR com PTAX do Banco Central na data do pagamento), competência, data de pagamento, pagador. Sem anexos.
- ✅ Competência x caixa nos relatórios.
- ✅ Rateio (valor total e sua parte).
- ✅ Taxa pendente como compromisso futuro, separada do que já foi gasto.

## 8. Filtros e busca

- ✅ Todos os filtros combináveis (datas, veículo, Qualis, indexação/JCR/quartis/JIF, publicação, autoria, custos, qualidade dos dados), salvos como "visões" e válidos para lista e relatórios.
- ✅ Busca livre sem diferenciar acentos e maiúsculas.
- ⏳ Filtro "com/sem anexo" (fase 2).

## 9. Relatórios

- ✅ Cabeçalho com nome, ORCID, Lattes, período e data de emissão; respeitam os filtros; PDF (impressão do navegador), XLSX e CSV.
- ✅ Despesas por competência/caixa (mês, ano, tipo de taxa, tipo de publicação, veículo, pagador, pago x pendente, gráfico mensal, custo médio por publicação e por estrato Qualis, itens gratuitos).
- ✅ Coautores (ranking, tipos, anos, instituição, ORCID, rede de colaboração).
- ✅ Artigos por subtipo, Anais, Relatos (em e fora de periódico), Livros e capítulos, Jornais.
- 🟡 Indicadores do pesquisador: totais por ano/tipo/estrato, com/sem JCR, % autor principal. Soma de citações na fase 3.
- ✅ Qualidade dos dados.
- ✅ Referências em ABNT NBR 6023 e Vancouver.
- ✅ Relatório de submissões (por status e revista, tempos médios, taxa de aceite, pagamentos futuros).
- ✅ Agrupamento de grafias de coautores após confirmação.
- ✅ Painel inicial: total publicado, aceitos, em avaliação, gasto no ano e no mês, próximos 3 pagamentos (+ prazos e lembretes).

## 10. Requisitos técnicos, LGPD e aceite

- ✅ Responsivo (celular), dados de exemplo, testes automáticos.
- ✅ Um conector por fonte; chaves em variáveis de ambiente.
- ✅ LGPD: termo de consentimento no primeiro acesso, exportar e excluir todos os dados, registro de acessos.
- ✅ Backup diário automático (últimos 30) + exportação completa JSON/XLSX.
- ⏳ Exportação dos anexos em ZIP (fase 2, junto com os anexos).
- ✅ Acessibilidade: contraste, foco visível, rótulos em todos os campos, alternativa de teclado ao arrastar no quadro.

### Critérios de aceite

| # | Critério | Situação |
|---|---|---|
| 1 | Importar 2 vezes o mesmo XML do Lattes não cria itens | ⏳ fase 2 (a deduplicação que ele usa já está testada) |
| 2 | ORCID + mesmo DOI mescla sem duplicar nem apagar | ✅ mescla testada; importação em lote do ORCID na fase 2 |
| 3 | Taxa R$ 0,00 aceita, "gratuito", entra no relatório | ✅ testado |
| 4 | Relatório por competência soma meses e moedas | ✅ testado |
| 5 | Ranking junta grafias após confirmação | ✅ testado |
| 6 | CPF inválido e senha com letras recusados | ✅ testado |
| 7 | Atualizar JIF atualiza todos os artigos | ✅ testado |
| 8 | DOI preenche em até 5 s e avisa duplicidade | ✅ testado (APIs simuladas) |
| 9 | Busca por autor marca os já cadastrados | ✅ testado |
| 10 | PDF com DOI preenche; PDF já cadastrado só anexa | ⏳ fase 2 |
| 11 | Publicado sai de Submissões; desfazer devolve | ✅ testado |
| 12 | Prazo de pareceres gera lembrete 7 e 2 dias antes | ✅ testado |
| 13 | Certificado lido e ligado ao registro | ⏳ fase 2 |
| 14 | Rotina mensal grava citações sem apagar anteriores | ⏳ fase 3 |

## 11. Submissões em andamento

- ✅ Seção própria (Em elaboração → Aceito); Recusado/Retirado em "Encerrados", reaproveitáveis.
- ✅ Quadro kanban arrastável (com "Mover para" pelo teclado), dias desde a última movimentação.
- ✅ ID da submissão, link do sistema, data de cada status, rodada, prazo, editor, taxa prevista.
- 🟡 Lembretes 7 e 2 dias antes (prazo e pagamento) e após 90 dias parados (ajustável): no painel; por e-mail só com SMTP configurado.
- ✅ Ressubmissão guardando a sequência de revistas.
- ✅ Ao marcar Publicado pede DOI e data, completa pelo DOI, selo "novo", ação reversível.
- ⏳ Detecção automática de submetidos já publicados (rotina mensal, fase 2).
- ✅ Relatório de submissões.

## 12. Anexos e certificados

- ⏳ Fase 2.

## 13. Outras atividades acadêmicas

- ⏳ Fase 3.

## 14. Evolução das citações

- ⏳ Fase 3.
