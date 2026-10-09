import pg from 'pg';

// Postgres devolve numeric como string por padrão. Aqui a precisão não é monetária
// de alta exigência, e número é mais útil que string nas contas de precificação.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('ERRO: a variável DATABASE_URL não está definida. Veja o .env.example.');
  process.exit(1);
}

export const pool = new pg.Pool({
  connectionString: url,
  max: Number(process.env.DB_POOL_MAX ?? 8),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (e) => console.error('[db] erro no pool:', e.message));

export async function q<T = any>(texto: string, valores: any[] = []): Promise<T[]> {
  const r = await pool.query(texto, valores);
  return r.rows as T[];
}

export async function um<T = any>(texto: string, valores: any[] = []): Promise<T | null> {
  const linhas = await q<T>(texto, valores);
  return linhas[0] ?? null;
}

export async function emTransacao<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/** Espera o Postgres aceitar conexão. O compose sobe os dois ao mesmo tempo. */
export async function esperarBanco(tentativas = 30): Promise<void> {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e: any) {
      if (i === tentativas) {
        throw new Error(
          `Não consegui conectar no Postgres depois de ${tentativas} tentativas. ` +
            `Confira DATABASE_URL. Último erro: ${e.message}`,
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// ----------------------------------------------------------------- config k/v

export async function lerConfig<T = any>(chave: string, padrao: T | null = null): Promise<T | null> {
  const r = await um<{ valor: T }>('SELECT valor FROM config WHERE chave = $1', [chave]);
  return r ? r.valor : padrao;
}

export async function gravarConfig(chave: string, valor: unknown): Promise<void> {
  await q(
    `INSERT INTO config (chave, valor, atualizado) VALUES ($1, $2, now())
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado = now()`,
    [chave, JSON.stringify(valor)],
  );
}
