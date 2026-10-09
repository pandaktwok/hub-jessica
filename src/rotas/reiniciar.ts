import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pool, lerConfig } from '../db.ts';
import { molde } from './setup.ts';
import { pagina } from '../visao/layout.ts';
import { COOKIE_MENTORA } from '../auth.ts';

// Botão "Reiniciar teste". Apaga o que o teste produziu e volta o assistente ao começo,
// apagando também a conta da mentora (o cadastro recomeça do zero), mantendo a conexão da IA e o conteúdo de fábrica (perguntas e prompts).
// A senha vem do ambiente (SENHA_REINICIAR), nunca do código: o repositório é público.
const tentativas: number[] = [];

function confere(dada: string): boolean {
  const certa = process.env.SENHA_REINICIAR ?? '';
  if (!certa) return false;
  const a = Buffer.from(dada);
  const b = Buffer.from(certa);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function rotasReiniciar(app: FastifyInstance) {
  app.get('/reiniciar', async (req: any, res) => {
    if (!req.mentora) return res.redirect('/entrar');
    const ligado = Boolean(process.env.SENHA_REINICIAR);
    return res.type('text/html').send(
      molde(
        0,
        'Reiniciar o teste',
        ligado
          ? `<div class="aviso"><strong>Isto apaga tudo o que o teste produziu:</strong> mentoradas e diagnósticos,
              respostas de exemplo dos módulos, PDFs de exemplo, documentos enviados, skills geradas, perfil,
              preço e a pasta escolhida. Apaga também a sua conta de acesso: depois você cria a conta de novo, na primeira etapa. Ficam só a conexão da IA e as perguntas de fábrica.
              Não dá para desfazer.</div>
            <form method="post" action="/reiniciar">
              <div class="campo"><label for="senha">Senha para reiniciar</label>
                <input id="senha" name="senha" type="password" required autocomplete="off"></div>
              <div class="acoes"><button type="submit">Apagar e recomeçar</button>
                <a class="botao calmo" href="/setup">Cancelar</a></div>
            </form>`
          : `<div class="aviso">O botão está desligado: falta definir <code>SENHA_REINICIAR</code> no arquivo
              <code>.env</code> do servidor.</div>
             <div class="acoes"><a class="botao calmo" href="/setup">Voltar</a></div>`,
      ),
    );
  });

  app.post<{ Body: { senha?: string } }>('/reiniciar', async (req: any, res) => {
    if (!req.mentora) return res.redirect('/entrar');

    const agora = Date.now();
    while (tentativas.length && agora - tentativas[0] > 10 * 60_000) tentativas.shift();
    if (tentativas.length >= 5) {
      return res.code(429).type('text/html').send(
        molde(0, 'Reiniciar o teste', `<div class="erro">Muitas tentativas. Espere 10 minutos.</div>`),
      );
    }
    if (!confere(String(req.body?.senha ?? ''))) {
      tentativas.push(agora);
      return res.code(403).type('text/html').send(
        molde(0, 'Reiniciar o teste',
          `<div class="erro">Senha incorreta. Nada foi apagado.</div>
           <div class="acoes"><a class="botao" href="/reiniciar">Tentar de novo</a></div>`),
      );
    }

    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('TRUNCATE mentoradas CASCADE');
      await c.query('TRUNCATE exemplos, exemplo_saidas, materiais, skills, modulo_estado, observacoes, rodadas');
      await c.query("UPDATE prompts SET texto_mentora = NULL, versao_mentora = 0");
      await c.query("DELETE FROM config WHERE chave IN ('perfil','precificacao','precificacao_v2','precificacao_v3','pasta_pc','consentimento_textos','consentimento_versao')");
      await c.query('TRUNCATE mentora CASCADE');
      await c.query("UPDATE setup_etapas SET concluida = false, concluida_em = NULL, dados = '{}'::jsonb");
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }

    const base = (await lerConfig<{ caminho: string }>('armazenamento'))?.caminho ?? '/dados/acervo';
    await rm(join(base, 'materiais'), { recursive: true, force: true }).catch(() => {});

    res.clearCookie(COOKIE_MENTORA, { path: '/' });
    return res.type('text/html').send(
      pagina(
        { titulo: 'Teste reiniciado', capa: { selo: 'Hub de Diagnóstico', titulo: 'Teste reiniciado' } },
        `<div class="cartao"><div class="ok">Tudo apagado, inclusive a conta. O assistente voltou ao começo.</div>
         <div class="acoes"><a class="botao" href="/setup/conta">Criar a conta de novo</a></div></div>`,
      ),
    );
  });
}

