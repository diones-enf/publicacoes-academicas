// Estrutura do banco. Cada item da lista é uma migração: nunca altere uma
// migração já publicada; acrescente uma nova no final.

export const MIGRACOES: string[] = [
  /* 1 — Fase 1 */ `
  -- Contas: o autor principal e seus leitores convidados.
  CREATE TABLE usuario (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER REFERENCES usuario(id) ON DELETE CASCADE, -- leitor: aponta para o autor
    perfil TEXT NOT NULL CHECK (perfil IN ('autor','leitor')),
    cpf_hmac TEXT NOT NULL UNIQUE,
    cpf_mascara TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    nome TEXT NOT NULL,
    nomes_citacao TEXT NOT NULL DEFAULT '[]', -- lista JSON: ["ROSA, D. R.", "ROSA, D."]
    orcid TEXT,
    lattes_id TEXT,
    email TEXT,
    data_nascimento TEXT,
    area_qualis_ref TEXT,
    dias_sem_movimentacao INTEGER NOT NULL DEFAULT 90,
    consentimento_em TEXT,
    recuperacao_hash TEXT,         -- código de recuperação mostrado no cadastro
    recuperacao_email_hash TEXT,   -- código temporário enviado por e-mail
    recuperacao_email_expira TEXT,
    falhas_seguidas INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessao (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    criada_em TEXT NOT NULL DEFAULT (datetime('now')),
    ultimo_uso TEXT NOT NULL DEFAULT (datetime('now')),
    encerrada INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE log_acesso (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER,
    cpf_mascara TEXT,
    evento TEXT NOT NULL,
    detalhe TEXT,
    em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Tipos e subtipos editáveis pelo usuário.
  CREATE TABLE tipo_publicacao (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    chave TEXT NOT NULL,   -- artigo, relato, livro, capitulo, anais, apresentacao, jornal, tecnica
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE subtipo_publicacao (
    id INTEGER PRIMARY KEY,
    tipo_id INTEGER NOT NULL REFERENCES tipo_publicacao(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1
  );

  -- Revistas, editoras, eventos e jornais. As métricas pertencem ao veículo.
  CREATE TABLE veiculo (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    nome_normalizado TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'revista' CHECK (tipo IN ('revista','editora','evento','jornal')),
    issn TEXT,
    eissn TEXT,
    editora TEXT,
    pais TEXT,
    site TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_veiculo_issn ON veiculo(dono_id, issn);
  CREATE INDEX ix_veiculo_eissn ON veiculo(dono_id, eissn);

  CREATE TABLE metrica_veiculo (
    id INTEGER PRIMARY KEY,
    veiculo_id INTEGER NOT NULL REFERENCES veiculo(id) ON DELETE CASCADE,
    indicador TEXT NOT NULL, -- QUALIS, JIF, JIF5, JCI, QUARTIL_JCR, POSICAO_JCR, CATEGORIA_JCR, COLECAO_WOS, SJR, CITESCORE, QUARTIL_SCOPUS, H5
    valor TEXT NOT NULL,
    area TEXT,               -- área de avaliação (Qualis) ou categoria (JCR/Scopus)
    periodo TEXT,            -- ano (JCR 2024) ou quadriênio (2021-2024)
    selo TEXT NOT NULL DEFAULT 'informado_usuario'
      CHECK (selo IN ('confirmado_oficial','informado_revista','informado_usuario','nao_localizado')),
    fonte TEXT,
    conferido_em TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_metrica_veiculo ON metrica_veiculo(veiculo_id, indicador);

  CREATE TABLE indexacao_veiculo (
    id INTEGER PRIMARY KEY,
    veiculo_id INTEGER NOT NULL REFERENCES veiculo(id) ON DELETE CASCADE,
    base TEXT NOT NULL,      -- WoS SCIE, Scopus, SciELO, PubMed/MEDLINE, LILACS, BDENF, DOAJ...
    situacao TEXT NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa','interrompida')),
    selo TEXT NOT NULL DEFAULT 'informado_usuario'
      CHECK (selo IN ('confirmado_oficial','informado_revista','informado_usuario','nao_localizado')),
    fonte TEXT,
    conferido_em TEXT
  );

  CREATE TABLE evento (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    edicao TEXT,
    cidade TEXT,
    data TEXT,
    instituicao_promotora TEXT
  );

  -- Registro único por publicação.
  CREATE TABLE publicacao (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    titulo_normalizado TEXT NOT NULL,
    tipo_id INTEGER NOT NULL REFERENCES tipo_publicacao(id),
    subtipo_id INTEGER REFERENCES subtipo_publicacao(id),
    status TEXT NOT NULL,
    data_submissao TEXT,
    data_aceite TEXT,
    data_publicacao TEXT,
    ano INTEGER,
    volume TEXT,
    numero TEXT,
    paginas TEXT,           -- páginas ou e-locator
    idioma TEXT,
    doi TEXT,
    isbn TEXT,
    issn TEXT,
    link TEXT,
    area_tematica TEXT,
    palavras_chave TEXT,
    resumo TEXT,
    observacoes TEXT,
    veiculo_id INTEGER REFERENCES veiculo(id) ON DELETE SET NULL,
    evento_id INTEGER REFERENCES evento(id) ON DELETE SET NULL,
    -- campos específicos por tipo
    editora TEXT,
    edicao TEXT,
    cidade TEXT,
    livro_titulo TEXT,
    organizadores TEXT,
    modalidade TEXT,
    premiacao TEXT,
    instituicao TEXT,
    registro TEXT,
    -- autoria do autor principal
    papel_autor TEXT,        -- Autor principal / Coautor / Correspondente / Orientador
    -- submissões em andamento
    id_submissao TEXT,
    link_sistema TEXT,
    rodada_revisao INTEGER,
    prazo_resposta TEXT,
    editor_responsavel TEXT,
    -- taxas obrigatórias: 1 = "Ainda não sei"
    taxa_submissao_nao_sei INTEGER NOT NULL DEFAULT 0,
    taxa_publicacao_nao_sei INTEGER NOT NULL DEFAULT 0,
    selo_novo INTEGER NOT NULL DEFAULT 0,
    ultima_movimentacao TEXT,
    busca TEXT NOT NULL DEFAULT '',  -- texto normalizado para a busca livre
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_pub_dono ON publicacao(dono_id, status);
  CREATE INDEX ix_pub_doi ON publicacao(dono_id, doi);
  CREATE INDEX ix_pub_titulo ON publicacao(dono_id, titulo_normalizado);

  CREATE TABLE coautor (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    nome_citacao TEXT,
    chave_nome TEXT NOT NULL,
    orcid TEXT,
    lattes_id TEXT,
    instituicao TEXT,
    email TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_coautor_chave ON coautor(dono_id, chave_nome);

  -- Grafias já juntadas num mesmo coautor (após confirmação do usuário).
  CREATE TABLE coautor_variacao (
    id INTEGER PRIMARY KEY,
    coautor_id INTEGER NOT NULL REFERENCES coautor(id) ON DELETE CASCADE,
    grafia TEXT NOT NULL
  );

  -- Pares que o usuário disse que NÃO são a mesma pessoa.
  CREATE TABLE coautor_nao_fundir (
    a_id INTEGER NOT NULL,
    b_id INTEGER NOT NULL,
    PRIMARY KEY (a_id, b_id)
  );

  CREATE TABLE autoria (
    id INTEGER PRIMARY KEY,
    publicacao_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL,
    eh_principal INTEGER NOT NULL DEFAULT 0,
    coautor_id INTEGER REFERENCES coautor(id) ON DELETE SET NULL,
    nome_exibido TEXT NOT NULL,
    correspondente INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX ix_autoria_pub ON autoria(publicacao_id);
  CREATE INDEX ix_autoria_coautor ON autoria(coautor_id);

  CREATE TABLE lancamento_custo (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    publicacao_id INTEGER REFERENCES publicacao(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,          -- Taxa de submissão, Taxa de publicação (APC), Inscrição em evento...
    descricao TEXT,
    valor REAL NOT NULL,         -- valor total na moeda original
    moeda TEXT NOT NULL DEFAULT 'BRL',
    cotacao REAL NOT NULL DEFAULT 1,
    cotacao_data TEXT,
    cotacao_estimada INTEGER NOT NULL DEFAULT 0,
    valor_brl REAL NOT NULL,     -- total em reais
    parte_autor_brl REAL NOT NULL, -- parte paga pelo autor principal (rateio)
    competencia TEXT NOT NULL,   -- AAAA-MM
    data_pagamento TEXT,         -- vazio = pendente
    data_vencimento TEXT,        -- previsão de pagamento (compromisso futuro)
    pagador TEXT NOT NULL DEFAULT 'Próprio',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_custo_pub ON lancamento_custo(publicacao_id);
  CREATE INDEX ix_custo_dono ON lancamento_custo(dono_id, competencia);

  CREATE TABLE historico_status (
    id INTEGER PRIMARY KEY,
    publicacao_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    status_anterior TEXT,
    data TEXT NOT NULL,
    rodada INTEGER,
    prazo_resposta TEXT,
    veiculo_id INTEGER REFERENCES veiculo(id) ON DELETE SET NULL,
    observacao TEXT,
    -- foto dos campos alterados pela mudança, para permitir desfazer
    desfazer_json TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_hist_status_pub ON historico_status(publicacao_id);

  -- Sequência de revistas tentadas (ressubmissão).
  CREATE TABLE tentativa_submissao (
    id INTEGER PRIMARY KEY,
    publicacao_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    veiculo_id INTEGER REFERENCES veiculo(id) ON DELETE SET NULL,
    nome_veiculo TEXT,
    data_submissao TEXT,
    data_desfecho TEXT,
    desfecho TEXT
  );

  CREATE TABLE versao_relacionada (
    a_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    b_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    PRIMARY KEY (a_id, b_id)
  );

  -- De onde veio cada campo (Crossref, OpenAlex, ORCID, manual...) e quando.
  CREATE TABLE origem_campo (
    id INTEGER PRIMARY KEY,
    publicacao_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    campo TEXT NOT NULL,
    valor TEXT,
    fonte TEXT NOT NULL,
    em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_origem_pub ON origem_campo(publicacao_id, campo);

  CREATE TABLE historico_alteracao (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL,
    tabela TEXT NOT NULL,
    registro_id INTEGER NOT NULL,
    campo TEXT NOT NULL,
    valor_antigo TEXT,
    valor_novo TEXT,
    origem TEXT NOT NULL DEFAULT 'manual',
    usuario_id INTEGER,
    em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_hist_alt ON historico_alteracao(tabela, registro_id);

  CREATE TABLE lembrete (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    publicacao_id INTEGER REFERENCES publicacao(id) ON DELETE CASCADE,
    lancamento_id INTEGER REFERENCES lancamento_custo(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,        -- prazo_resposta, pagamento, sem_movimentacao
    data_alvo TEXT NOT NULL,
    antecedencia INTEGER,      -- 7 ou 2 dias
    mensagem TEXT NOT NULL,
    lido INTEGER NOT NULL DEFAULT 0,
    email_enviado INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (dono_id, tipo, publicacao_id, lancamento_id, data_alvo, antecedencia)
  );

  -- Pares que o usuário disse que NÃO são duplicatas ("manter os dois").
  CREATE TABLE duplicata_descartada (
    a_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    b_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    PRIMARY KEY (a_id, b_id)
  );

  CREATE TABLE visao_salva (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    filtros TEXT NOT NULL
  );
  `,
  /* 2 — "Autor único" passa a ser "Autor principal" */ `
  UPDATE publicacao SET papel_autor = 'Autor principal' WHERE papel_autor = 'Autor único';
  `,
  /* 3 — Listas oficiais importadas (Qualis e JCR), usadas para preencher as revistas pelo ISSN */ `
  CREATE TABLE ref_qualis (
    issn TEXT NOT NULL,
    titulo TEXT,
    area TEXT NOT NULL,
    estrato TEXT NOT NULL,
    periodo TEXT NOT NULL
  );
  CREATE INDEX ix_ref_qualis_issn ON ref_qualis(issn);
  CREATE TABLE ref_jcr (
    issn TEXT NOT NULL,
    titulo TEXT,
    ano TEXT NOT NULL,
    jif TEXT,
    jif5 TEXT,
    jci TEXT,
    quartil TEXT,
    categoria TEXT,
    edicao TEXT
  );
  CREATE INDEX ix_ref_jcr_issn ON ref_jcr(issn);
  CREATE TABLE importacao_lista (
    id INTEGER PRIMARY KEY,
    tipo TEXT NOT NULL,
    arquivo TEXT,
    periodo TEXT,
    linhas INTEGER,
    em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
  /* 4 — busca do Qualis pelo nome da revista */ `
  ALTER TABLE ref_qualis ADD COLUMN titulo_normalizado TEXT;
  CREATE INDEX ix_ref_qualis_titulo ON ref_qualis(titulo_normalizado);
  `,
  /* 5 — nomes recalculados sem "(ONLINE)" etc. */ `
  UPDATE ref_qualis SET titulo_normalizado = NULL;
  `,
  /* 6 — Evolução das citações (fase 3) */ `
  ALTER TABLE publicacao ADD COLUMN openalex_id TEXT;

  -- Foto mensal das citações de cada publicação, por fonte. Nunca é apagada:
  -- rodar de novo no mesmo mês só atualiza o número daquele mês.
  CREATE TABLE citacao_mensal (
    id INTEGER PRIMARY KEY,
    publicacao_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    fonte TEXT NOT NULL,
    mes TEXT NOT NULL,
    total INTEGER NOT NULL,
    registrado_em TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (publicacao_id, fonte, mes)
  );

  -- Citações recebidas em cada ano (informadas pelo OpenAlex).
  CREATE TABLE citacao_ano (
    publicacao_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    fonte TEXT NOT NULL,
    ano INTEGER NOT NULL,
    total INTEGER NOT NULL,
    PRIMARY KEY (publicacao_id, fonte, ano)
  );

  -- Trabalhos que citaram cada publicação.
  CREATE TABLE trabalho_citante (
    id INTEGER PRIMARY KEY,
    publicacao_id INTEGER NOT NULL REFERENCES publicacao(id) ON DELETE CASCADE,
    fonte TEXT NOT NULL,
    id_externo TEXT NOT NULL,
    titulo TEXT,
    ano INTEGER,
    data TEXT,
    doi TEXT,
    revista TEXT,
    UNIQUE (publicacao_id, fonte, id_externo)
  );

  -- Foto mensal dos indicadores do pesquisador (total, índice h e i10) por fonte.
  CREATE TABLE indicador_mensal (
    id INTEGER PRIMARY KEY,
    dono_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    fonte TEXT NOT NULL,
    mes TEXT NOT NULL,
    total INTEGER NOT NULL,
    h INTEGER NOT NULL,
    i10 INTEGER NOT NULL,
    publicacoes INTEGER NOT NULL,
    registrado_em TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (dono_id, fonte, mes)
  );
  `,
];
