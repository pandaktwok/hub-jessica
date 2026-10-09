import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Cifra das chaves de API guardadas no banco.
// A chave-mestra vem de CHAVE_CIFRA no .env. Se não houver, o programa gera uma sozinho na
// primeira vez e a guarda num arquivo no volume de dados (fora do banco, modo 600). Assim um
// dump do banco, sozinho, não abre as chaves, e ninguém precisa configurar nada para começar.
// Perder o volume de dados significa perder essa chave-mestra: as chaves de API guardadas
// ficam ilegíveis e é só cadastrá-las de novo.

export interface Cifrado {
  cifrada: Buffer;
  iv: Buffer;
  tag: Buffer;
}

function arquivoDaChave(): string {
  return join(process.env.PASTA_DADOS ?? '/dados/acervo', '.chave-mestra');
}

function chaveMestra(): Buffer {
  const env = process.env.CHAVE_CIFRA ?? '';
  if (env.length >= 16) return createHash('sha256').update(env).digest();

  const arq = arquivoDaChave();
  try {
    if (existsSync(arq)) {
      const t = readFileSync(arq, 'utf8').trim();
      if (t.length >= 32) return createHash('sha256').update(t).digest();
    }
    mkdirSync(dirname(arq), { recursive: true });
    const nova = randomBytes(32).toString('hex');
    writeFileSync(arq, nova + '\n', { mode: 0o600 });
    return createHash('sha256').update(nova).digest();
  } catch (e: any) {
    throw new Error(
      `Não consegui criar a chave que protege as chaves de API (${e?.code ?? e?.message}). ` +
        'Defina CHAVE_CIFRA no .env do servidor (16+ caracteres) e reinicie.',
    );
  }
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
