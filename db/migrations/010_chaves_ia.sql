-- Chave de API de cada provedor, guardada cifrada (AES-256-GCM). A chave de cifra
-- fica no .env do servidor (CHAVE_CIFRA), nunca no banco. Só o final da chave
-- (final4) é mostrado de volta na tela.
CREATE TABLE IF NOT EXISTS chaves_ia (
  provedor      text PRIMARY KEY,
  cifrada       bytea NOT NULL,
  iv            bytea NOT NULL,
  tag           bytea NOT NULL,
  final4        text NOT NULL,
  cadastrada_em timestamptz NOT NULL DEFAULT now()
);
