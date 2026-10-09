import type { FastifyInstance } from 'fastify';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { q, um, lerConfig, gravarConfig } from '../db.ts';
import { hashSenha, abrirSessaoMentora, COOKIE_MENTORA, opcoesCookie } from '../auth.ts';
import { pagina, trilha, esc } from '../visao/layout.ts';
import { configIA, testar, MODELO_PADRAO, type Provedor } from '../ia/index.ts';
import { PESSOAS, TRATAMENTOS, TONS, skillPersona, type Perfil } from '../persona.ts';

// Conectar a IA e escolher onde guardar os arquivos saíram do assistente dela:
// são configuração técnica de quem instala, não decisão da mentora. As rotas
// continuam existindo em /config, fora da contagem de etapas.
export const TOTAL = 6;

export const NUMERO: Record<string, number> = {
  conta: 1, perfil: 2, pasta: 3, modulos: 4, skills: 5, precificacao: 6,
};

interface Etapa {
  numero: number;
  slug: string;
  titulo: string;
  obrigatoria: boolean;
  concluida: boolean;
  dados: any;
}

export async function etapas(): Promise<Etapa[]> {
  return q<Etapa>('SELECT numero, slug, titulo, obrigatoria, concluida, dados FROM setup_etapas ORDER BY numero');
}

export async function setupCompleto(): Promise<boolean> {
  const faltando = await um<{ n: string }>(
    'SELECT count(*)::text AS n FROM setup_etapas WHERE obrigatoria AND NOT concluida',
  );
  return Number(faltando?.n ?? '1') === 0;
}

// Os textos de consentimento ficam para a próxima revisão. Enquanto isso o cadastro de
// mentorada não depende deles.
export async function consentimentoPronto(): Promise<boolean> {
  return true;
}

export async function concluir(slug: string, dados: Record<string, unknown> = {}) {
  await q(
    `UPDATE setup_etapas
        SET concluida = true, concluida_em = now(), dados = dados || $2::jsonb
      WHERE slug = $1`,
    [slug, JSON.stringify(dados)],
  );
}

export function molde(n: number, titulo: string, corpo: string, sub?: string) {
  return pagina(
    {
      admin: true,
      titulo: `${titulo} — Configuração`,
      capa: { selo: n ? 'Configuração inicial' : 'Ajuste técnico', titulo, sub },
    },
    `${n ? trilha(n, TOTAL) : ''}<div class="cartao">${corpo}</div>
     <div class="passo-txt"><a href="/setup">Voltar para a lista de etapas</a></div>`,
  );
}

export function botoes(voltar = '/setup', rotulo = 'Salvar e continuar') {
  return `<div class="acoes">
    <button type="submit">${esc(rotulo)}</button>
    <a class="botao calmo" href="${esc(voltar)}">Voltar</a>
  </div>`;
}

export default async function rotasSetup(app: FastifyInstance) {
  // ------------------------------------------------------------- painel
  app.get('/setup', async (_req, res) => {
    const es = await etapas();
    const proxima = es.find((e) => !e.concluida);
    const itens = es
      .map((e) => {
        const estado = e.concluida ? 'feita' : e.numero === proxima?.numero ? 'agora' : '';
        const marca = e.concluida ? '✓' : String(e.numero);
        return `<li>
          <span class="marca ${estado}">${marca}</span>
          <span>
            <span class="etapa-nome"><a href="/setup/${esc(e.slug)}">${esc(e.titulo)}</a></span>
            ${e.obrigatoria ? '' : '<small> — opcional, pode pular</small>'}
          </span>
        </li>`;
      })
      .join('');

    const pronto = await setupCompleto();
    return res.type('text/html').send(
      pagina(
        {
          admin: true,
          titulo: 'Configuração inicial',
          capa: {
            selo: 'Hub de Diagnóstico',
            titulo: 'Vamos preparar o seu Hub',
            sub: 'Seis etapas. Dá para parar e voltar quando quiser.',
          },
        },
        `<div class="cartao">
          ${trilha(proxima?.numero ?? TOTAL, TOTAL)}
          <ul class="lista-etapas">${itens}</ul>
          ${
            pronto
              ? `<div class="ok">Tudo pronto. <a href="/admin">Ir para o painel</a>.</div>`
              : `<div class="acoes"><a class="botao" href="/setup/${esc(proxima!.slug)}">Continuar da etapa ${proxima!.numero}</a></div>`
          }
        </div>`,
      ),
    );
  });

  // ------------------------------------------------------------- 1. conta
  app.get('/setup/conta', async (_req, res) => {
    const existe = await um('SELECT id FROM mentora LIMIT 1');
    if (existe) {
      return res.type('text/html').send(
        molde(NUMERO.conta, 'Sua conta', `<div class="ok">A conta já foi criada.</div>
          <div class="acoes"><a class="botao" href="/setup">Continuar</a></div>`),
      );
    }
    return res.type('text/html').send(
      molde(
        NUMERO.conta,
        'Sua conta',
        `<p class="sub">Esta é a conta que você vai usar para entrar no painel. Ninguém mais tem acesso a ela.</p>
        <form method="post" action="/setup/conta">
          <div class="campo"><label for="nome">Seu nome</label>
            <input id="nome" name="nome" type="text" required autocomplete="name"></div>
          <div class="campo"><label for="email">Seu e-mail</label>
            <input id="email" name="email" type="email" required autocomplete="email"></div>
          <div class="campo"><label for="senha">Senha</label>
            <div class="dica">Pelo menos 10 caracteres.</div>
            <input id="senha" name="senha" type="password" required minlength="10" autocomplete="new-password"></div>
          ${botoes()}
        </form>`,
        undefined,
      ),
    );
  });

  app.post<{ Body: { nome: string; email: string; senha: string } }>('/setup/conta', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome?.trim() || !email?.trim() || !senha || senha.length < 10) {
      return res.type('text/html').send(
        molde(NUMERO.conta, 'Sua conta', `<div class="erro">Preencha nome, e-mail e uma senha de pelo menos 10 caracteres.</div>
          <div class="acoes"><a class="botao" href="/setup/conta">Voltar</a></div>`),
      );
    }
    const existe = await um('SELECT id FROM mentora LIMIT 1');
    if (existe) return res.redirect('/setup');

    const { hash, salt } = await hashSenha(senha);
    const m = await um<{ id: string }>(
      'INSERT INTO mentora (nome, email, senha_hash, senha_salt) VALUES ($1, $2, $3, $4) RETURNING id',
      [nome.trim(), email.trim().toLowerCase(), hash, salt],
    );
    await concluir('conta', { email: email.trim().toLowerCase() });
    const token = await abrirSessaoMentora(m!.id);
    res.setCookie(COOKIE_MENTORA, token, opcoesCookie);
    return res.redirect('/setup');
  });

  // ------------------------------------------------------------- 2. IA
  app.get('/config/ia', async (_req, res) => {
    const cfg = await configIA();
    const opcoes = (['claude', 'openai', 'gemini', 'meta'] as Provedor[])
      .map((p) => {
        const nome = { claude: 'Claude (Anthropic)', openai: 'ChatGPT (OpenAI)', gemini: 'Gemini (Google)', meta: 'Meta AI (Llama)' }[p as 'claude'];
        return `<option value="${p}"${cfg.provedor === p ? ' selected' : ''}>${esc(nome)}</option>`;
      })
      .join('');
    return res.type('text/html').send(
      molde(
        0,
        'Conectar a inteligência artificial',
        `<p class="sub">O Hub usa uma inteligência artificial para montar os textos do diagnóstico.
          A chave fica no arquivo de configuração do servidor, nunca aqui na tela.</p>
        <form method="post" action="/config/ia">
          <div class="campo"><label for="provedor">Qual provedor</label>
            <select id="provedor" name="provedor">${opcoes}</select>
            <div class="exemplo">A chave correspondente precisa estar no .env: CLAUDE_API_KEY,
              OPENAI_API_KEY, GEMINI_API_KEY ou META_API_KEY.</div></div>
          <div class="campo"><label for="modelo">Modelo (deixe em branco para o padrão)</label>
            <input id="modelo" name="modelo" type="text" value="${esc(cfg.modelo ?? '')}"
              placeholder="${esc(MODELO_PADRAO[cfg.provedor] ?? '')}"></div>
          <div class="aviso">Ao salvar, o Hub faz uma chamada de teste e mostra o resultado aqui.
            Nada é dado por certo sem a ida e volta funcionar.</div>
          ${botoes('/setup', 'Salvar e testar')}
        </form>`,
      ),
    );
  });

  app.post<{ Body: { provedor: Provedor; modelo?: string } }>('/config/ia', async (req, res) => {
    const cfg = { provedor: req.body.provedor, modelo: req.body.modelo?.trim() || undefined };
    const r = await testar(cfg);
    if (!r.ok) {
      return res.type('text/html').send(
        molde(0, 'Conectar a inteligência artificial',
          `<div class="erro"><strong>A conexão não funcionou.</strong><br>${esc(r.detalhe)}</div>
           <p class="sub">A configuração não foi salva. Corrija a chave no arquivo .env do servidor,
             reinicie e tente de novo.</p>
           <div class="acoes"><a class="botao" href="/config/ia">Tentar de novo</a></div>`),
      );
    }
    await gravarConfig('ia', cfg);
    await concluir('ia', { provedor: cfg.provedor, modelo: cfg.modelo ?? MODELO_PADRAO[cfg.provedor] });
    return res.type('text/html').send(
      molde(0, 'Conectar a inteligência artificial',
        `<div class="ok"><strong>Funcionou.</strong> A inteligência artificial respondeu:
          <br><em>${esc(r.detalhe)}</em></div>
         <div class="acoes"><a class="botao" href="/setup">Continuar</a></div>`),
    );
  });

  // ------------------------------------------------------------- 3. armazenamento
  app.get('/config/armazenamento', async (_req, res) => {
    const atual = (await lerConfig<{ caminho: string }>('armazenamento'))?.caminho ?? '/dados/acervo';
    return res.type('text/html').send(
      molde(
        0,
        'Onde guardar os arquivos',
        `<p class="sub">Os arquivos ficam em pasta no servidor. O Hub escreve e lê um arquivo de
          teste agora para confirmar que o caminho funciona de verdade.</p>
        <form method="post" action="/config/armazenamento">
          <div class="campo"><label for="caminho">Caminho da pasta</label>
            <div class="dica">No Docker, use um caminho dentro do volume montado.</div>
            <input id="caminho" name="caminho" type="text" value="${esc(atual)}" required>
            <div class="exemplo">/dados/acervo</div></div>
          ${botoes('/setup', 'Salvar e testar')}
        </form>`,
      ),
    );
  });

  app.post<{ Body: { caminho: string } }>('/config/armazenamento', async (req, res) => {
    const caminho = req.body.caminho?.trim();
    try {
      await mkdir(caminho, { recursive: true });
      const teste = join(caminho, '.hub-teste');
      await writeFile(teste, 'ok', 'utf8');
      const lido = await readFile(teste, 'utf8');
      await unlink(teste);
      if (lido !== 'ok') throw new Error('o arquivo de teste voltou diferente do que foi escrito');
    } catch (e: any) {
      return res.type('text/html').send(
        molde(0, 'Onde guardar os arquivos',
          `<div class="erro"><strong>Não consegui escrever em ${esc(caminho)}.</strong><br>${esc(e.message)}</div>
           <p class="sub">Confira se a pasta existe no servidor e se o contêiner tem permissão de escrita nela.</p>
           <div class="acoes"><a class="botao" href="/config/armazenamento">Tentar de novo</a></div>`),
      );
    }
    await gravarConfig('armazenamento', { caminho });
    await concluir('armazenamento', { caminho });
    return res.type('text/html').send(
      molde(0, 'Onde guardar os arquivos',
        `<div class="ok">Escrita e leitura confirmadas em <strong>${esc(caminho)}</strong>.</div>
         <div class="acoes"><a class="botao" href="/setup">Continuar</a></div>`),
    );
  });

  // ------------------------------------------------------------- 2. perfil e voz
  app.get('/setup/perfil', async (_req, res) => {
    const p = ((await lerConfig<any>('perfil')) ?? {}) as Perfil;
    const pessoa = p.pessoa ?? 'primeira';
    const trat = p.tratamento ?? 'voce';
    const tons = new Set(p.tom ?? ['acolhedor', 'direto']);

    const radios = (nome: string, lista: { id: string; rotulo: string }[], atual: string) =>
      lista
        .map(
          (o) => `<label><input type="radio" name="${nome}" value="${o.id}"${o.id === atual ? ' checked' : ''}>${esc(o.rotulo)}</label>`,
        )
        .join('');
    const caixas = TONS.map(
      (o) => `<label><input type="checkbox" name="tom" value="${o.id}"${tons.has(o.id) ? ' checked' : ''}>${esc(o.rotulo)}</label>`,
    ).join('');

    return res.type('text/html').send(
      molde(
        NUMERO.perfil,
        'Seu perfil e a voz do assistente',
        `<div class="aviso"><strong>O objetivo desta fase.</strong> Gerar a documentação de skills e
          ver o programa funcionando de ponta a ponta, para depois montar uma versão mais robusta
          com skills melhores. Nada do que está aqui precisa ser definitivo.</div>
        <form method="post" action="/setup/perfil">
          <div class="campo"><label for="nome">Como você quer ser chamada</label>
            <input id="nome" name="nome" type="text" value="${esc(p.nome ?? '')}" required>
            <div class="exemplo">Aparece em frases como "Jessica vai revisar isso com você".</div></div>
          <div class="campo"><label for="marca">Nome da sua mentoria</label>
            <input id="marca" name="marca" type="text" value="${esc(p.marca ?? '')}"></div>

          <h3>Como o assistente fala</h3>
          <div class="campo"><label>Como ele se refere a si mesmo</label>
            <div class="escolhas">${radios('pessoa', PESSOAS, pessoa)}</div></div>
          <div class="campo"><label>Como ele trata a mentorada</label>
            <div class="escolhas">${radios('tratamento', TRATAMENTOS, trat)}</div></div>
          <div class="campo"><label>O jeito de escrever <small>(marque quantos quiser)</small></label>
            <div class="escolhas">${caixas}</div></div>

          <div class="campo"><label for="apresentacao">Como o assistente se apresenta</label>
            <div class="dica">Uma ou duas frases.</div>
            <textarea id="apresentacao" name="apresentacao">${esc(p.apresentacao ?? '')}</textarea>
            <div class="exemplo">Sou a assistente de diagnóstico da mentoria. Ajudo você a organizar o posicionamento do seu trabalho.</div></div>
          <div class="campo"><label for="observacoes">Observações sobre a sua forma de escrever</label>
            <div class="dica">Qualquer detalhe que as caixas acima não pegam.</div>
            <textarea id="observacoes" name="observacoes">${esc(p.observacoes ?? '')}</textarea>
            <div class="exemplo">Não uso ponto de exclamação. Prefiro frases curtas, quase uma por linha.</div></div>
          <div class="campo"><label for="exemplo_escrita">Um exemplo de como você escreve</label>
            <div class="dica">Cole um texto seu: uma legenda, uma mensagem para paciente, um trecho de aula.</div>
            <textarea id="exemplo_escrita" name="exemplo_escrita" style="min-height:160px">${esc(p.exemplo_escrita ?? '')}</textarea></div>
          ${botoes()}
        </form>`,
      ),
    );
  });

  app.post<{ Body: Record<string, any> }>('/setup/perfil', async (req, res) => {
    const b = req.body ?? {};
    const lista = (v: unknown): string[] => (Array.isArray(v) ? v : v ? [v] : []).map(String);
    const perfil: Perfil = {
      nome: String(b.nome ?? '').trim(),
      marca: String(b.marca ?? '').trim(),
      apresentacao: String(b.apresentacao ?? '').trim(),
      pessoa: PESSOAS.some((x) => x.id === b.pessoa) ? b.pessoa : 'primeira',
      tratamento: TRATAMENTOS.some((x) => x.id === b.tratamento) ? b.tratamento : 'voce',
      tom: lista(b.tom).filter((id) => TONS.some((t) => t.id === id)),
      observacoes: String(b.observacoes ?? '').trim().slice(0, 2000),
      exemplo_escrita: String(b.exemplo_escrita ?? '').trim().slice(0, 4000),
    };
    if (!perfil.nome) return res.redirect('/setup/perfil');
    await gravarConfig('perfil', perfil);

    // A voz vira a primeira skill: persona-assistente. Sem IA no meio.
    const s = skillPersona(perfil);
    await q(
      `INSERT INTO skills (nome, descricao, quando_usar, instrucoes, origem, revisada)
       VALUES ($1,$2,$3,$4,'manual',true)
       ON CONFLICT (nome) DO UPDATE SET descricao=EXCLUDED.descricao, quando_usar=EXCLUDED.quando_usar,
         instrucoes=EXCLUDED.instrucoes, atualizado=now()`,
      [s.nome, s.descricao, s.quando_usar, s.instrucoes],
    );

    await concluir('perfil', { nome: perfil.nome });
    return res.redirect('/setup');
  });
}
