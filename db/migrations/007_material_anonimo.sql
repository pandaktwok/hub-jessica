-- Registro do que foi retirado de cada material na entrada.
ALTER TABLE materiais ADD COLUMN IF NOT EXISTS anonimizado boolean NOT NULL DEFAULT false;
ALTER TABLE materiais ADD COLUMN IF NOT EXISTS removidos jsonb NOT NULL DEFAULT '{}'::jsonb;
