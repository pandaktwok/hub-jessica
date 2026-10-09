-- Hub de Diagnóstico — schema inicial
-- Regra de migração: aditiva E com valor padrão ou aceitando nulo, para que a imagem
-- anterior continue rodando sobre o schema novo durante um rollback.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- configuração

-- Chave/valor da instalação. O assistente de primeiro acesso escreve aqui.
CREATE TABLE IF NOT EXISTS config (
  chave      text PRIMARY KEY,
  valor      jsonb NOT NULL,
  atualizado timestamptz NOT NULL DEFAULT now()
);

-- Etapas do assistente de primeiro acesso.
CREATE TABLE IF NOT EXISTS setup_etapas (
  numero      smallint PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  titulo      text NOT NULL,
  obrigatoria boolean NOT NULL DEFAULT true,
  concluida   boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  dados       jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------- mentora (admin)

CREATE TABLE IF NOT EXISTS mentora (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  email       text NOT NULL UNIQUE,
  senha_hash  bytea NOT NULL,
  senha_salt  bytea NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessoes_mentora (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentora_id  uuid NOT NULL REFERENCES mentora(id) ON DELETE CASCADE,
  token_hash  bytea NOT NULL UNIQUE,
  expira_em   timestamptz NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- conteúdo editável

-- Prompts em duas camadas: o arquivo de fábrica e a edição da mentora.
-- Atualizar a imagem troca a fábrica e nunca encosta na camada dela.
CREATE TABLE IF NOT EXISTS prompts (
  slug           text PRIMARY KEY,          -- '_sistema', 'modulo-1' .. 'modulo-6', 'mapa'
  titulo         text NOT NULL,
  texto_fabrica  text NOT NULL DEFAULT '',
  texto_mentora  text,                      -- nulo = usando o de fábrica
  versao_fabrica integer NOT NULL DEFAULT 1,
  versao_mentora integer NOT NULL DEFAULT 0,
  atualizado     timestamptz NOT NULL DEFAULT now()
);

-- As perguntas são conteúdo editável igual aos prompts, não constante no código.
CREATE TABLE IF NOT EXISTS perguntas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo      smallint NOT NULL CHECK (modulo BETWEEN 1 AND 6),
  campo       text NOT NULL,                -- chave estável, nunca muda
  rotulo      text NOT NULL,                -- o que a mentorada lê
  ajuda       text,
  exemplo     text,                         -- exemplo real no campo vazio
  tipo        text NOT NULL DEFAULT 'texto_longo'
              CHECK (tipo IN ('texto_curto','texto_longo','numero','escolha')),
  opcoes      jsonb,
  ordem       smallint NOT NULL,
  obrigatoria boolean NOT NULL DEFAULT true,
  ativa       boolean NOT NULL DEFAULT true,
  UNIQUE (modulo, campo)
);

-- Material que a Jessica sobe durante a configuração: livros, PDFs, referências.
CREATE TABLE IF NOT EXISTS materiais (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo     smallint CHECK (modulo BETWEEN 0 AND 6),  -- 0 = geral
  nome       text NOT NULL,
  tipo       text NOT NULL,                 -- 'arquivo' | 'texto' | 'referencia'
  caminho    text,                          -- onde foi guardado em disco
  conteudo   text,                          -- texto extraído ou colado
  bytes      bigint,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_materiais_modulo ON materiais(modulo);

-- Skills registradas: lidas da IA conectada ou coladas por ela.
CREATE TABLE IF NOT EXISTS skills (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  descricao  text,
  origem     text NOT NULL DEFAULT 'colada' CHECK (origem IN ('automatica','colada','manual')),
  conteudo   text,                          -- corpo da skill, quando existe
  ativa      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- Categorias do acervo. 'mentoria' é a que o Hub escreve (decisão 60a0cb74).
CREATE TABLE IF NOT EXISTS categorias (
  slug      text PRIMARY KEY,
  nome      text NOT NULL,
  cor       text NOT NULL DEFAULT '#E8C978',
  fixa      boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- mentoradas

CREATE TABLE IF NOT EXISTS mentoradas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                 text NOT NULL,
  email                text NOT NULL UNIQUE,
  status               text NOT NULL DEFAULT 'ativa'
                       CHECK (status IN ('ativa','pausada','concluida')),
  iniciou_em           timestamptz NOT NULL DEFAULT now(),
  consentimento_versao text NOT NULL,
  consentimento_em     timestamptz NOT NULL DEFAULT now(),
  consentimento_dados  boolean NOT NULL DEFAULT false,
  consentimento_guarda boolean NOT NULL DEFAULT false,
  consentimento_ia     boolean NOT NULL DEFAULT false,
  consentimento_perfil boolean NOT NULL DEFAULT false,
  perfil_revogado_em   timestamptz,
  excluir_em           timestamptz
);

CREATE TABLE IF NOT EXISTS links_acesso (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorada_id uuid NOT NULL REFERENCES mentoradas(id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,
  expira_em    timestamptz NOT NULL,
  usado_em     timestamptz,
  ip_pedido    inet,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_link_mentorada ON links_acesso(mentorada_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS sessoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorada_id uuid NOT NULL REFERENCES mentoradas(id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,
  expira_em    timestamptz NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diagnosticos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorada_id uuid NOT NULL REFERENCES mentoradas(id) ON DELETE CASCADE,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS um_diagnostico_ativo
  ON diagnosticos(mentorada_id) WHERE concluido_em IS NULL;

CREATE TABLE IF NOT EXISTS respostas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id uuid NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  modulo         smallint NOT NULL CHECK (modulo BETWEEN 1 AND 6),
  campo          text NOT NULL,
  valor          text NOT NULL,
  salvo_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnostico_id, modulo, campo)
);

CREATE SEQUENCE IF NOT EXISTS seq_versao_geracao;

CREATE TABLE IF NOT EXISTS geracoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id   uuid NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  modulo           smallint NOT NULL CHECK (modulo BETWEEN 1 AND 6),
  -- o banco distribui a versão: dois cliques de "gerar de novo" não corrida
  versao           integer NOT NULL DEFAULT nextval('seq_versao_geracao'),
  conteudo         jsonb,                   -- nulo enquanto estado = 'gerando'
  conteudo_editado jsonb,
  estado           text NOT NULL DEFAULT 'gerando'
                   CHECK (estado IN ('gerando','rascunho','aceita','descartada','falhou')),
  prompt_hash      bytea,
  prompt_texto     text,
  provedor         text,
  modelo           text,
  tokens_in        integer,
  tokens_out       integer,
  custo_centavos   integer,
  glossario_ok     boolean NOT NULL DEFAULT true,
  clinico_ok       boolean NOT NULL DEFAULT true,
  erro             text,
  sb_arquivo_id    text,
  iniciado_em      timestamptz NOT NULL DEFAULT now(),
  concluido_em     timestamptz,
  UNIQUE (diagnostico_id, modulo, versao)
);
CREATE INDEX IF NOT EXISTS idx_ger_diag ON geracoes(diagnostico_id, modulo);

-- Histórico de edições: geracoes NÃO é append-only, então o histórico mora aqui.
CREATE TABLE IF NOT EXISTS edicoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geracao_id uuid NOT NULL REFERENCES geracoes(id) ON DELETE CASCADE,
  conteudo   jsonb NOT NULL,
  editado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perfis (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id uuid NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  padroes        jsonb NOT NULL,            -- padrões derivados, nunca resposta crua
  gerado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perfis_diag ON perfis(diagnostico_id, gerado_em DESC);

-- Fila de publicação no Second Brain. Fora do v1, mas a tabela nasce junto
-- para a migração não ser destrutiva depois.
CREATE TABLE IF NOT EXISTS fila_publicacao (
  id                bigserial PRIMARY KEY,
  geracao_id        uuid NOT NULL UNIQUE REFERENCES geracoes(id) ON DELETE CASCADE,
  diagnostico_id    uuid NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  modulo            smallint NOT NULL,
  estado            text NOT NULL DEFAULT 'pendente'
                    CHECK (estado IN ('pendente','enviando','concluido','parado')),
  tentativas        integer NOT NULL DEFAULT 0,
  proxima_tentativa timestamptz NOT NULL DEFAULT now(),
  ultimo_erro       text,
  criado_em         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fila_drenar ON fila_publicacao(estado, proxima_tentativa)
  WHERE estado = 'pendente';
