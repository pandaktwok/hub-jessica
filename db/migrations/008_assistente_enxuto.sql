-- Assistente da mentora enxuto para a fase de teste:
--   sai: categorias do acervo (só entram com o Second Brain) e textos de consentimento
--   entra: escolher a pasta do computador dela
--   módulos passam a ter exemplo preenchido, documentos com citação e PDF de exemplo
-- Tudo aditivo, com padrão ou aceitando nulo.

-- Reorganiza as etapas sem perder o que já foi concluído.
UPDATE setup_etapas SET numero = numero + 100;
DELETE FROM setup_etapas WHERE slug IN ('categorias', 'consentimento');

INSERT INTO setup_etapas (numero, slug, titulo, obrigatoria)
SELECT 103, 'pasta', 'A pasta do seu computador', false
 WHERE NOT EXISTS (SELECT 1 FROM setup_etapas WHERE slug = 'pasta');

UPDATE setup_etapas SET numero = 1, titulo = 'Sua conta'                 WHERE slug = 'conta';
UPDATE setup_etapas SET numero = 2, titulo = 'Seu perfil e a voz do assistente' WHERE slug = 'perfil';
UPDATE setup_etapas SET numero = 3                                       WHERE slug = 'pasta';
UPDATE setup_etapas SET numero = 4, titulo = 'Os seis módulos'           WHERE slug = 'modulos';
UPDATE setup_etapas SET numero = 5, titulo = 'Skills geradas', obrigatoria = false WHERE slug = 'skills';
UPDATE setup_etapas SET numero = 6, titulo = 'O preço da sua mentoria'   WHERE slug = 'precificacao';

-- Citação opcional de um documento de referência (livro, capítulo, páginas).
ALTER TABLE materiais ADD COLUMN IF NOT EXISTS citacao text;

-- Exemplo de preenchimento: as perguntas de entrada de cada módulo, respondidas pela mentora.
CREATE TABLE IF NOT EXISTS exemplos (
  modulo     smallint NOT NULL CHECK (modulo BETWEEN 1 AND 6),
  campo      text NOT NULL,
  valor      text NOT NULL DEFAULT '',
  salvo_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (modulo, campo)
);

-- O que a IA gerou a partir do exemplo, para virar PDF e a mentora dar feedback.
CREATE TABLE IF NOT EXISTS exemplo_saidas (
  modulo         smallint PRIMARY KEY CHECK (modulo BETWEEN 1 AND 6),
  estado         text NOT NULL DEFAULT 'pronto',
  conteudo       jsonb,
  erro           text,
  provedor       text,
  modelo         text,
  custo_centavos integer,
  gerado_em      timestamptz NOT NULL DEFAULT now()
);
