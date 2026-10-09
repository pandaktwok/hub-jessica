-- Skills geradas a partir do material que a mentora subiu em cada módulo.

ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_origem_check;
ALTER TABLE skills ADD CONSTRAINT skills_origem_check
  CHECK (origem IN ('automatica','colada','manual','gerada'));

ALTER TABLE skills ADD COLUMN IF NOT EXISTS modulo smallint;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS instrucoes text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS quando_usar text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS revisada boolean NOT NULL DEFAULT false;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS gerada_por text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS atualizado timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_skills_modulo ON skills(modulo);
