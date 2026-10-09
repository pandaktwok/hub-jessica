-- Ciclo de cada módulo: gerar skill + PDF, receber observações, gerar de novo, aprovar.
-- Nada de arquivo no servidor: o que a mentora sobe vira texto no banco e a cópia
-- fica na pasta do computador dela.

CREATE TABLE IF NOT EXISTS modulo_estado (
  modulo      smallint PRIMARY KEY CHECK (modulo BETWEEN 1 AND 6),
  aprovado    boolean NOT NULL DEFAULT false,
  aprovado_em timestamptz,
  rodada      integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS observacoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo       smallint NOT NULL CHECK (modulo BETWEEN 1 AND 6),
  texto        text NOT NULL,
  origem       text NOT NULL DEFAULT 'texto',
  nome_arquivo text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_observacoes_modulo ON observacoes(modulo, criado_em);

-- Histórico: a cada geração a skill é reescrita do zero; a anterior fica guardada aqui.
CREATE TABLE IF NOT EXISTS rodadas (
  modulo         smallint NOT NULL CHECK (modulo BETWEEN 1 AND 6),
  rodada         integer NOT NULL,
  skill          jsonb,
  saida          jsonb,
  provedor       text,
  modelo         text,
  custo_centavos integer,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (modulo, rodada)
);
