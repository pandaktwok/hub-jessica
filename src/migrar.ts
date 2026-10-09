import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, esperarBanco } from './db.ts';

const aqui = dirname(fileURLToPath(import.meta.url));
const pastaMigracoes = join(aqui, '..', 'db', 'migrations');

export async function migrar(): Promise<void> {
  await esperarBanco();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS migracoes (
      arquivo    text PRIMARY KEY,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )`);

  const arquivos = (await readdir(pastaMigracoes)).filter((f) => f.endsWith('.sql')).sort();
  const jaAplicadas = new Set(
    (await pool.query<{ arquivo: string }>('SELECT arquivo FROM migracoes')).rows.map(
      (r) => r.arquivo,
    ),
  );

  for (const arquivo of arquivos) {
    if (jaAplicadas.has(arquivo)) continue;
    const sql = await readFile(join(pastaMigracoes, arquivo), 'utf8');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('INSERT INTO migracoes (arquivo) VALUES ($1)', [arquivo]);
      await c.query('COMMIT');
      console.log(`[migrar] aplicada: ${arquivo}`);
    } catch (e: any) {
      await c.query('ROLLBACK');
      throw new Error(`Falhou a migração ${arquivo}: ${e.message}`);
    } finally {
      c.release();
    }
  }
  console.log(`[migrar] banco em dia (${arquivos.length} migrações no total).`);
}

// Permite rodar sozinho: node --experimental-strip-types src/migrar.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  migrar()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
