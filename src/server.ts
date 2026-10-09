import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { pool, q, um, lerConfig } from './db.ts';
import { migrar } from './migrar.ts';
import { pagina, esc } from './visao/layout.ts';
import { configIA, chaveDoAmbiente } from './ia/index.ts';
import {
  COOKIE_MENTORA,
  mentoraDaSessao,
  fecharSessaoMentora,
  conferirSenha,
  abrirSessaoMentora,
  opcoesCookie,
} from './auth.ts';
import rotasSetup, { etapas, setupCompleto } from './rotas/setup.ts';
import rotasConsultoria from './rotas/consultoria.ts';
import rotasMentoradas from './rotas/mentoradas.ts';
import rotasSkills from './rotas/skills.ts';

const app = Fastify({
  logger: { level: process.env.LOG_NIVEL ?? 'info' },
  trustProxy: true,
  bodyLimit: 2 * 1024 * 1024,
});

await app.register(cookie);
await app.register(formbody);
await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

// ------------------------------------------------------------------ saúde

app.get('/healthz', async (_req, res) => {
  const estado: Record<string, { ok: boolean; detalhe: string }> = {};

  try {
    await pool.query('SELECT 1');
    estado.banco = { ok: true, detalhe: 'respondendo' };
  } catch (e: any) {
    estado.banco = { ok: false, detalhe: `sem conexão: ${e.message}` };
  }

  const cfg = await configIA().catch(() => null);
  if (!cfg) {
    estado.ia = { ok: false, detalhe: 'não foi possível ler a configuração' };
  } else if (cfg.provedor === 'stub') {
    estado.ia = { ok: true, detalhe: 'modo de simulação, sem chamar API' };
  } else if (!chaveDoAmbiente(cfg.provedor)) {
    estado.ia = {
      ok: false,
      detalhe: `falta a chave de ${cfg.provedor} no .env do servidor`,
    };
  } else {
    estado.ia = { ok: true, detalhe: `${cfg.provedor} configurado` };
  }

  // O Hub funciona sem o Second Brain por desenho. Fora do ar não é incidente.
  const sb = await lerConfig<{ url?: string }>('second_brain');
  estado.second_brain = sb?.url
    ? { ok: true, detalhe: 'configurado' }
    : { ok: true, detalhe: 'não configurado, e o Hub não depende dele' };

  const saudavel = estado.banco.ok && estado.ia.ok;
  return res.code(saudavel ? 200 : 503).send({
    saudavel,
    versao: process.env.VERSAO ?? '0.1.0',
    estado,
  });
});

// ------------------------------------------------------------------ autenticação da mentora

app.decorateRequest('mentora', null);

app.addHook('preHandler', async (req: any) => {
  req.mentora = await mentoraDaSessao(req.cookies?.[COOKIE_MENTORA]);
});

function exigirMentora(req: any, res: any) {
  if (!req.mentora) {
    res.redirect('/entrar');
    return false;
  }
  return true;
}

app.get('/entrar', async (req: any, res) => {
  if (req.mentora) return res.redirect('/admin');
  const existe = await um('SELECT id FROM mentora LIMIT 1');
  if (!existe) return res.redirect('/setup');
  return res.type('text/html').send(
    pagina(
      { titulo: 'Entrar', capa: { selo: 'Hub de Diagnóstico', titulo: 'Entrar' } },
      `<div class="cartao">
        <form method="post" action="/entrar">
          <div class="campo"><label for="email">E-mail</label>
            <input id="email" name="email" type="email" required autocomplete="email"></div>
          <div class="campo"><label for="senha">Senha</label>
            <input id="senha" name="senha" type="password" required autocomplete="current-password"></div>
          <div class="acoes"><button type="submit">Entrar</button></div>
        </form>
      </div>`,
    ),
  );
});

app.post<{ Body: { email: string; senha: string } }>('/entrar', async (req, res) => {
  const m = await um<{ id: string; senha_hash: Buffer; senha_salt: Buffer }>(
    'SELECT id, senha_hash, senha_salt FROM mentora WHERE email = $1',
    [(req.body.email ?? '').trim().toLowerCase()],
  );
  const ok = m ? await conferirSenha(req.body.senha ?? '', m.senha_hash, m.senha_salt) : false;
  if (!ok) {
    return res.type('text/html').send(
      pagina(
        { titulo: 'Entrar', capa: { selo: 'Hub de Diagnóstico', titulo: 'Entrar' } },
        `<div class="cartao"><div class="erro">E-mail ou senha não conferem.</div>
          <div class="acoes"><a class="botao" href="/entrar">Tentar de novo</a></div></div>`,
      ),
    );
  }
  res.setCookie(COOKIE_MENTORA, await abrirSessaoMentora(m!.id), opcoesCookie);
  return res.redirect('/admin');
});

app.get('/sair', async (req: any, res) => {
  await fecharSessaoMentora(req.cookies?.[COOKIE_MENTORA]);
  res.clearCookie(COOKIE_MENTORA, { path: '/' });
  return res.redirect('/entrar');
});

// ------------------------------------------------------------------ assistente

await app.register(rotasSetup);
await app.register(rotasConsultoria);
await app.register(rotasMentoradas);
await app.register(rotasSkills);

// ------------------------------------------------------------------ painel

app.get('/admin', async (req: any, res) => {
  if (!exigirMentora(req, res)) return;

  const pronto = await setupCompleto();
  const es = await etapas();
  const pendentes = es.filter((e) => e.obrigatoria && !e.concluida);
  const perfil = (await lerConfig<any>('perfil')) ?? {};
  const contagem = await um<{ n: string }>('SELECT count(*)::text AS n FROM mentoradas');
  const custo = await um<{ c: string | null }>(
    `SELECT sum(custo_centavos)::text AS c FROM geracoes
      WHERE iniciado_em >= date_trunc('month', now())`,
  );
  const centavos = Number(custo?.c ?? 0);

  return res.type('text/html').send(
    pagina(
      {
        titulo: 'Painel',
        capa: {
          selo: perfil.marca || 'Hub de Diagnóstico',
          titulo: `Bom te ver, ${perfil.nome || req.mentora.nome}`,
        },
      },
      `${
        pronto
          ? ''
          : `<div class="cartao"><div class="aviso">
              <strong>A configuração ainda não terminou.</strong> Faltam ${pendentes.length}
              ${pendentes.length === 1 ? 'etapa obrigatória' : 'etapas obrigatórias'}:
              ${esc(pendentes.map((e) => e.titulo).join(', '))}.
              <br><a href="/setup">Continuar a configuração</a>
            </div></div>`
      }
      <div class="cartao">
        <h2>Resumo</h2>
        <table><tbody>
          <tr><td>Mentoradas cadastradas</td><td class="num">${esc(contagem?.n ?? '0')}</td></tr>
          <tr><td>Custo de IA no mês</td><td class="num">US$ ${(centavos / 100).toFixed(2)}</td></tr>
          <tr><td>Versão</td><td class="num">${esc(process.env.VERSAO ?? '0.1.0')}</td></tr>
        </tbody></table>
      </div>
      <div class="cartao">
        <h2>O que dá para fazer</h2>
        <ul class="lista-etapas">
          <li><span class="marca">·</span><span><a href="/admin/mentoradas">Mentoradas</a> — cadastrar, gerar link e acompanhar onde cada uma está</span></li>
          <li><span class="marca">·</span><span><a href="/admin/skills">Skills</a> — gerar a partir do seu material e revisar</span></li>
          <li><span class="marca">·</span><span><a href="/setup/modulos">Módulos e material</a> — subir referências e ajustar instruções</span></li>
          <li><span class="marca">·</span><span><a href="/setup">Configuração inicial</a> — as nove etapas</span></li>
          <li><span class="marca">·</span><span><a href="/setup/precificacao">Custos e preço</a></span></li>
          <li><span class="marca">·</span><span><a href="/healthz">Saúde do sistema</a></span></li>
        </ul>
      </div>
      <div class="passo-txt"><a href="/sair">Sair</a></div>`,
    ),
  );
});

// ------------------------------------------------------------------ raiz

app.get('/', async (req: any, res) => {
  const existe = await um('SELECT id FROM mentora LIMIT 1');
  if (!existe) return res.redirect('/setup');
  if (req.mentora) return res.redirect('/admin');
  return res.redirect('/entrar');
});

app.setNotFoundHandler(async (_req, res) =>
  res
    .code(404)
    .type('text/html')
    .send(
      pagina(
        { titulo: 'Não encontrado', capa: { titulo: 'Esta página não existe' } },
        `<div class="cartao"><p class="sub">O endereço que você abriu não corresponde a nada no Hub.</p>
          <div class="acoes"><a class="botao" href="/">Voltar ao início</a></div></div>`,
      ),
    ),
);

// ------------------------------------------------------------------ partida

const porta = Number(process.env.PORT ?? 3000);

try {
  await migrar();
  await app.listen({ port: porta, host: '0.0.0.0' });
  app.log.info(`Hub de Diagnóstico no ar na porta ${porta}`);
} catch (e: any) {
  console.error(`\nO Hub não conseguiu subir.\n${e.message}\n`);
  process.exit(1);
}

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => {
    app.log.info('encerrando');
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
