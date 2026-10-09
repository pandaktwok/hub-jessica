import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { q, um } from './db.ts';

const scryptAsync = promisify(scrypt);

export async function hashSenha(senha: string): Promise<{ hash: Buffer; salt: Buffer }> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(senha, salt, 64)) as Buffer;
  return { hash, salt };
}

export async function conferirSenha(senha: string, hash: Buffer, salt: Buffer): Promise<boolean> {
  const tentativa = (await scryptAsync(senha, salt, 64)) as Buffer;
  return tentativa.length === hash.length && timingSafeEqual(tentativa, hash);
}

/** Token em claro para o cookie, hash para o banco. O banco nunca guarda o token. */
export function novoToken(): { claro: string; hash: Buffer } {
  const claro = randomBytes(32).toString('base64url');
  return { claro, hash: hashToken(claro) };
}

export function hashToken(claro: string): Buffer {
  return createHash('sha256').update(claro).digest();
}

const DIAS_14 = 14 * 24 * 60 * 60 * 1000;

export async function abrirSessaoMentora(mentoraId: string): Promise<string> {
  const { claro, hash } = novoToken();
  await q(
    'INSERT INTO sessoes_mentora (mentora_id, token_hash, expira_em) VALUES ($1, $2, $3)',
    [mentoraId, hash, new Date(Date.now() + DIAS_14)],
  );
  return claro;
}

export async function mentoraDaSessao(tokenClaro?: string) {
  if (!tokenClaro) return null;
  return um<{ id: string; nome: string; email: string }>(
    `SELECT m.id, m.nome, m.email
       FROM sessoes_mentora s JOIN mentora m ON m.id = s.mentora_id
      WHERE s.token_hash = $1 AND s.expira_em > now()`,
    [hashToken(tokenClaro)],
  );
}

export async function fecharSessaoMentora(tokenClaro?: string): Promise<void> {
  if (!tokenClaro) return;
  await q('DELETE FROM sessoes_mentora WHERE token_hash = $1', [hashToken(tokenClaro)]);
}

export const COOKIE_MENTORA = 'hj_mentora';

export const opcoesCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.COOKIE_SEGURO === 'true',
  maxAge: DIAS_14 / 1000,
};
