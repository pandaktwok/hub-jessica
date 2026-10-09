-- O Mapa consolidado não é um módulo. Guardá-lo em geracoes com modulo=6 colidia
-- com a geração do próprio módulo 6.

CREATE TABLE IF NOT EXISTS mapas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id uuid NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  conteudo       jsonb,
  estado         text NOT NULL DEFAULT 'gerando'
                 CHECK (estado IN ('gerando','pronto','falhou')),
  provedor       text,
  modelo         text,
  tokens_in      integer,
  tokens_out     integer,
  custo_centavos integer,
  erro           text,
  iniciado_em    timestamptz NOT NULL DEFAULT now(),
  concluido_em   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mapas_diag ON mapas(diagnostico_id, iniciado_em DESC);
