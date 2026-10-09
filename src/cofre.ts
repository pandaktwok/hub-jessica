import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Cifra das chaves de API guardadas no banco. A chave-mestra vem de CHAVE_CIFRA no .env
// do servidor. Sem ela, o sistema recusa guardar chave: não grava em claro.

export interface Cifrado {
  cifrada: Buffer;
  iv: Buffer;
  tag: Buffer;
}

function chaveMestra(): Buffer {
  const s = process.env.CHAVE_CIFRA ?? '';
  if (s.length < 16) {
    throw new Error(
      'CHAVE_CIFRA_AUSENTE: defina CHAVE_CIFRA no .env do servidor (pelo menos 16 caracteres) e reinicie, para guardar chaves.',
    );
  }
  return createHash('sha256').update(s).digest();
}

export function cifrar(texto: string): Cifrado {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chaveMestra(), iv);
  const cifrada = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return { cifrada, iv, tag: c.getAuthTag() };
}

export function decifrar(l: Cifrado): string {
  const d = createDecipheriv('aes-256-gcm', chaveMestra(), l.iv);
  d.setAuthTag(l.tag);
  return Buffer.concat([d.update(l.cifrada), d.final()]).toString('utf8');
}
