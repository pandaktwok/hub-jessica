import type { FastifyInstance } from 'fastify';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { q, um, lerConfig, gravarConfig } from '../db.ts';
import { hashSenha, abrirSessaoMentora, COOKIE_MENTORA, opcoesCookie } from '../auth.ts';
import { pagina, trilha, esc } from '../visao/layout.ts';
import { configIA, testar, MODELO_PADRAO, type Provedor } from '../ia/index.ts';
import { verificarGlossario } from '../verificador.ts';

const TOTAL = 9;

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

export async function consentimentoPronto(): Promise<boolean> {
  const e = await um<{ concluida: boolean }>(
    "SELECT concluida FROM setup_etapas WHERE slug = 'consentimento'",
  );
  return Boolean(e?.concluida);
}

async function concluir(slug: string, dados: Record<string, unknown> = {}) {
  await q(
    `UPDATE setup_etapas
        SET concluida = true, concluida_em = now(), dados = dados || $2::jsonb
      WHERE slug = $1`,
    [slug, JSON.stringify(dados)],
  );
}

function molde(n: number, titulo: string, corpo: string, sub?: string) {
  return pagina(
    { titulo: `${titulo} — Configuração`, capa: { selo: 'Configuração inicial', titulo, sub } },
    `${trilha(n, TOTAL)}<div class="cartao">${corpo}</div>
     <div class="passo-txt"><a href="/setup">Voltar para a lista de etapas</a></div>`,
  );
}

function botoes(voltar = '/setup', rotulo = 'Salvar e continuar') {
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
          titulo: 'Configuração inicial',
          capa: {
            selo: 'Hub de Diagnóstico',
            titulo: 'Vamos preparar o seu Hub',
            sub: 'Nove etapas. Dá para parar e voltar quando quiser.',
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
        molde(1, 'Sua conta', `<div class="ok">A conta já foi criada.</div>
          <div class="acoes"><a class="botao" href="/setup">Continuar</a></div>`),
      );
    }
    return res.type('text/html').send(
      molde(
        1,
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
        'Etapa 1 de 9',
      ),
    );
  });

  app.post<{ Body: { nome: string; email: string; senha: string } }>('/setup/conta', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome?.trim() || !email?.trim() || !senha || senha.length < 10) {
      return res.type('text/html').send(
        molde(1, 'Sua conta', `<div class="erro">Preencha nome, e-mail e uma senha de pelo menos 10 caracteres.</div>
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
  app.get('/setup/ia', async (_req, res) => {
    const cfg = await configIA();
    const opcoes = (['claude', 'openai', 'gemini', 'meta'] as Provedor[])
      .map((p) => {
        const nome = { claude: 'Claude (Anthropic)', openai: 'ChatGPT (OpenAI)', gemini: 'Gemini (Google)', meta: 'Meta AI (Llama)' }[p as 'claude'];
        return `<option value="${p}"${cfg.provedor === p ? ' selected' : ''}>${esc(nome)}</option>`;
      })
      .join('');
    return res.type('text/html').send(
      molde(
        2,
        'Conectar a inteligência artificial',
        `<p class="sub">O Hub usa uma inteligência artificial para montar os textos do diagnóstico.
          A chave fica no arquivo de configuração do servidor, nunca aqui na tela.</p>
        <form method="post" action="/setup/ia">
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

  app.post<{ Body: { provedor: Provedor; modelo?: string } }>('/setup/ia', async (req, res) => {
    const cfg = { provedor: req.body.provedor, modelo: req.body.modelo?.trim() || undefined };
    const r = await testar(cfg);
    if (!r.ok) {
      return res.type('text/html').send(
        molde(2, 'Conectar a inteligência artificial',
          `<div class="erro"><strong>A conexão não funcionou.</strong><br>${esc(r.detalhe)}</div>
           <p class="sub">A configuração não foi salva. Corrija a chave no arquivo .env do servidor,
             reinicie e tente de novo.</p>
           <div class="acoes"><a class="botao" href="/setup/ia">Tentar de novo</a></div>`),
      );
    }
    await gravarConfig('ia', cfg);
    await concluir('ia', { provedor: cfg.provedor, modelo: cfg.modelo ?? MODELO_PADRAO[cfg.provedor] });
    return res.type('text/html').send(
      molde(2, 'Conectar a inteligência artificial',
        `<div class="ok"><strong>Funcionou.</strong> A inteligência artificial respondeu:
          <br><em>${esc(r.detalhe)}</em></div>
         <div class="acoes"><a class="botao" href="/setup">Continuar</a></div>`),
    );
  });

  // ------------------------------------------------------------- 3. armazenamento
  app.get('/setup/armazenamento', async (_req, res) => {
    const atual = (await lerConfig<{ caminho: string }>('armazenamento'))?.caminho ?? '/dados/acervo';
    return res.type('text/html').send(
      molde(
        3,
        'Onde guardar os arquivos',
        `<p class="sub">Os arquivos ficam em pasta no servidor. O Hub escreve e lê um arquivo de
          teste agora para confirmar que o caminho funciona de verdade.</p>
        <form method="post" action="/setup/armazenamento">
          <div class="campo"><label for="caminho">Caminho da pasta</label>
            <div class="dica">No Docker, use um caminho dentro do volume montado.</div>
            <input id="caminho" name="caminho" type="text" value="${esc(atual)}" required>
            <div class="exemplo">/dados/acervo</div></div>
          ${botoes('/setup', 'Salvar e testar')}
        </form>`,
      ),
    );
  });

  app.post<{ Body: { caminho: string } }>('/setup/armazenamento', async (req, res) => {
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
        molde(3, 'Onde guardar os arquivos',
          `<div class="erro"><strong>Não consegui escrever em ${esc(caminho)}.</strong><br>${esc(e.message)}</div>
           <p class="sub">Confira se a pasta existe no servidor e se o contêiner tem permissão de escrita nela.</p>
           <div class="acoes"><a class="botao" href="/setup/armazenamento">Tentar de novo</a></div>`),
      );
    }
    await gravarConfig('armazenamento', { caminho });
    await concluir('armazenamento', { caminho });
    return res.type('text/html').send(
      molde(3, 'Onde guardar os arquivos',
        `<div class="ok">Escrita e leitura confirmadas em <strong>${esc(caminho)}</strong>.</div>
         <div class="acoes"><a class="botao" href="/setup">Continuar</a></div>`),
    );
  });

  // ------------------------------------------------------------- 4. skills
  app.get('/setup/skills', async (_req, res) => {
    const lista = await q<{ nome: string; descricao: string; origem: string }>(
      'SELECT nome, descricao, origem FROM skills ORDER BY nome',
    );
    const tabela = lista.length
      ? `<table><thead><tr><th>Skill</th><th>Descrição</th><th>Origem</th></tr></thead><tbody>
          ${lista.map((s) => `<tr><td>${esc(s.nome)}</td><td>${esc(s.descricao ?? '')}</td><td><small>${esc(s.origem)}</small></td></tr>`).join('')}
        </tbody></table>`
      : '<p class="sub">Nenhuma skill registrada ainda.</p>';

    return res.type('text/html').send(
      molde(
        4,
        'Suas skills',
        `<p class="sub">Se a sua conta de inteligência artificial não deixa o Hub ler a lista
          sozinho, dá para trazer na mão. É rápido.</p>
        <div class="aviso"><strong>Copie a frase abaixo e cole na sua inteligência artificial:</strong><br>
          <em>Liste todas as skills que você tem disponíveis, uma por linha, no formato
          nome — descrição curta. Sem texto antes nem depois.</em><br>
          Depois cole aqui a resposta que ela der.</div>
        ${tabela}
        <form method="post" action="/setup/skills">
          <div class="campo"><label for="colado">Cole aqui a lista</label>
            <textarea id="colado" name="colado" placeholder="revisar-texto — revisa e melhora um texto
resumir-pdf — resume um documento longo"></textarea></div>
          ${botoes('/setup', 'Registrar skills')}
        </form>
        <div class="acoes"><a class="botao calmo" href="/setup/skills/pular">Pular esta etapa</a></div>`,
      ),
    );
  });

  app.get('/setup/skills/pular', async (_req, res) => {
    await concluir('skills', { pulada: true });
    return res.redirect('/setup');
  });

  app.post<{ Body: { colado: string } }>('/setup/skills', async (req, res) => {
    const linhas = (req.body.colado ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 300);
    let registradas = 0;
    for (const linha of linhas) {
      const [nomeBruto, ...resto] = linha.split(/\s+[—–-]\s+/);
      const nome = nomeBruto.replace(/^[-*\d.\s]+/, '').trim();
      if (!nome) continue;
      await q(
        `INSERT INTO skills (nome, descricao, origem) VALUES ($1, $2, 'colada')
         ON CONFLICT (nome) DO UPDATE SET descricao = EXCLUDED.descricao`,
        [nome.slice(0, 200), resto.join(' — ').slice(0, 500) || null],
      );
      registradas++;
    }
    await concluir('skills', { registradas });
    return res.redirect('/setup');
  });

  // ------------------------------------------------------------- 5. categorias
  app.get('/setup/categorias', async (_req, res) => {
    const cats = await q<{ slug: string; nome: string; cor: string; fixa: boolean }>(
      'SELECT slug, nome, cor, fixa FROM categorias ORDER BY fixa DESC, nome',
    );
    const linhas = cats
      .map(
        (c) => `<tr>
          <td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${esc(c.cor)};margin-right:7px"></span>${esc(c.nome)}</td>
          <td><small>${esc(c.slug)}</small></td>
          <td>${c.fixa ? '<small>fixa</small>' : ''}</td>
        </tr>`,
      )
      .join('');
    return res.type('text/html').send(
      molde(
        5,
        'Categorias do acervo',
        `<p class="sub">Toda vez que algo for guardado no acervo, o Hub pergunta em qual categoria.
          Ele não escolhe sozinho.</p>
        <table><thead><tr><th>Categoria</th><th>Identificador</th><th></th></tr></thead><tbody>${linhas}</tbody></table>
        <form method="post" action="/setup/categorias">
          <h3>Acrescentar uma categoria</h3>
          <div class="campo"><label for="nome">Nome</label>
            <input id="nome" name="nome" type="text" placeholder="Por exemplo: a sua outra empresa"></div>
          <div class="campo"><label for="cor">Cor</label>
            <input id="cor" name="cor" type="color" value="#7FB2C9" style="width:70px;height:44px;padding:4px"></div>
          ${botoes('/setup', 'Salvar categorias')}
        </form>`,
      ),
    );
  });

  app.post<{ Body: { nome?: string; cor?: string } }>('/setup/categorias', async (req, res) => {
    const nome = req.body.nome?.trim();
    if (nome) {
      const slug = nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      if (slug) {
        await q(
          `INSERT INTO categorias (slug, nome, cor, fixa) VALUES ($1, $2, $3, false)
           ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, cor = EXCLUDED.cor`,
          [slug, nome.slice(0, 120), req.body.cor || '#7FB2C9'],
        );
      }
    }
    await concluir('categorias', {});
    return res.redirect(nome ? '/setup/categorias' : '/setup');
  });

  // ------------------------------------------------------------- 6. perfil
  app.get('/setup/perfil', async (_req, res) => {
    const p = (await lerConfig<any>('perfil')) ?? {};
    return res.type('text/html').send(
      molde(
        6,
        'Seu perfil de mentora',
        `<p class="sub">Nada do que está aqui fica escrito dentro do programa. É tudo configuração,
          o que significa que você pode mudar quando quiser.</p>
        <form method="post" action="/setup/perfil">
          <div class="campo"><label for="nome">Como você quer ser chamada no produto</label>
            <input id="nome" name="nome" type="text" value="${esc(p.nome ?? '')}" required>
            <div class="exemplo">Aparece em frases como "Jessica vai revisar isso com você".</div></div>
          <div class="campo"><label for="marca">Nome da sua mentoria</label>
            <input id="marca" name="marca" type="text" value="${esc(p.marca ?? '')}"></div>
          <div class="campo"><label for="apresentacao">Como a assistente se apresenta</label>
            <div class="dica">Uma ou duas frases, na primeira pessoa.</div>
            <textarea id="apresentacao" name="apresentacao">${esc(p.apresentacao ?? '')}</textarea>
            <div class="exemplo">Sou a assistente de diagnóstico da mentoria. Ajudo você a organizar o posicionamento do seu trabalho.</div></div>
          ${botoes()}
        </form>`,
      ),
    );
  });

  app.post<{ Body: { nome: string; marca?: string; apresentacao?: string } }>(
    '/setup/perfil',
    async (req, res) => {
      const perfil = {
        nome: req.body.nome?.trim(),
        marca: req.body.marca?.trim() ?? '',
        apresentacao: req.body.apresentacao?.trim() ?? '',
      };
      if (!perfil.nome) return res.redirect('/setup/perfil');
      await gravarConfig('perfil', perfil);
      await concluir('perfil', { nome: perfil.nome });
      return res.redirect('/setup');
    },
  );

  // ------------------------------------------------------------- 7. módulos
  app.get('/setup/modulos', async (_req, res) => {
    const mats = await q<{ modulo: number; n: string }>(
      'SELECT coalesce(modulo,0) AS modulo, count(*)::text AS n FROM materiais GROUP BY 1',
    );
    const porModulo = new Map(mats.map((m) => [Number(m.modulo), Number(m.n)]));
    const prompts = await q<{ slug: string; titulo: string; texto_mentora: string | null }>(
      "SELECT slug, titulo, texto_mentora FROM prompts WHERE slug LIKE 'modulo-%' ORDER BY slug",
    );
    const linhas = prompts
      .map((p, i) => {
        const n = i + 1;
        const qtd = porModulo.get(n) ?? 0;
        return `<li>
          <span class="marca ${qtd > 0 ? 'feita' : ''}">${qtd > 0 ? '✓' : n}</span>
          <span><span class="etapa-nome"><a href="/setup/modulos/${n}">${esc(p.titulo)}</a></span>
          <br><small>${qtd} ${qtd === 1 ? 'material' : 'materiais'}${p.texto_mentora ? ', instruções ajustadas por você' : ''}</small></span>
        </li>`;
      })
      .join('');
    const geral = porModulo.get(0) ?? 0;
    return res.type('text/html').send(
      molde(
        7,
        'Os seis módulos e o seu material',
        `<p class="sub">Esta é a etapa que define a qualidade do diagnóstico. Em cada módulo você
          sobe o seu material (livros, referências, anotações, exemplos de atendimento) e ajusta
          as instruções que a inteligência artificial vai seguir. É a partir daqui que ela
          aprende a escrever como você escreveria.</p>
        <h3>Material geral</h3>
        <p class="sub">${geral} ${geral === 1 ? 'arquivo' : 'arquivos'} que valem para todos os módulos.
          <a href="/setup/modulos/0">Abrir</a></p>
        <h3>Por módulo</h3>
        <ul class="lista-etapas">${linhas}</ul>
        <form method="post" action="/setup/modulos">
          ${botoes('/setup', 'Marcar esta etapa como concluída')}
        </form>`,
      ),
    );
  });

  app.get<{ Params: { n: string } }>('/setup/modulos/:n', async (req, res) => {
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 0 || n > 6) return res.callNotFound();

    const slug = n === 0 ? null : `modulo-${n}`;
    const prompt = slug
      ? await um<{ titulo: string; texto_fabrica: string; texto_mentora: string | null }>(
          'SELECT titulo, texto_fabrica, texto_mentora FROM prompts WHERE slug = $1',
          [slug],
        )
      : null;
    const mats = await q<{ id: string; nome: string; tipo: string; bytes: number }>(
      'SELECT id, nome, tipo, bytes FROM materiais WHERE coalesce(modulo,0) = $1 ORDER BY criado_em',
      [n],
    );
    const perguntas = n
      ? await q<{ campo: string; rotulo: string }>(
          'SELECT campo, rotulo FROM perguntas WHERE modulo = $1 AND ativa ORDER BY ordem',
          [n],
        )
      : [];

    const titulo = n === 0 ? 'Material geral' : (prompt?.titulo ?? `Módulo ${n}`);
    const listaMat = mats.length
      ? `<table><thead><tr><th>Material</th><th>Tipo</th><th></th></tr></thead><tbody>
          ${mats.map((m) => `<tr><td>${esc(m.nome)}</td><td><small>${esc(m.tipo)}</small></td>
            <td><a href="/setup/modulos/${n}/remover/${esc(m.id)}">remover</a></td></tr>`).join('')}
        </tbody></table>`
      : '<p class="sub">Nenhum material ainda.</p>';

    const listaPerg = perguntas.length
      ? `<h3>As perguntas deste módulo</h3>
         <p class="sub">É o que a mentorada vai responder. Dá para editar depois no painel.</p>
         <ul class="lista-etapas">${perguntas.map((p) => `<li><span class="marca">·</span><span>${esc(p.rotulo)}</span></li>`).join('')}</ul>`
      : '';

    return res.type('text/html').send(
      molde(
        7,
        titulo,
        `${listaMat}
        <form method="post" action="/setup/modulos/${n}/material" enctype="multipart/form-data">
          <h3>Acrescentar material</h3>
          <div class="campo"><label for="arquivo">Enviar um arquivo</label>
            <div class="dica">PDF, texto, markdown. Até 20 MB.</div>
            <input id="arquivo" name="arquivo" type="file"></div>
          <div class="campo"><label for="texto">Ou colar um texto</label>
            <textarea id="texto" name="texto" placeholder="Cole aqui uma referência, uma anotação, um trecho de livro que embasa este módulo."></textarea></div>
          <div class="campo"><label for="nome">Nome deste material</label>
            <input id="nome" name="nome" type="text" placeholder="Por exemplo: capítulo 3 do livro de posicionamento"></div>
          <div class="acoes"><button type="submit">Guardar material</button></div>
        </form>
        ${
          prompt
            ? `<form method="post" action="/setup/modulos/${n}/instrucoes">
                <h3>Instruções para a inteligência artificial</h3>
                <p class="sub">Este é o texto de fábrica. Edite à vontade: a sua versão fica guardada
                  separada e uma atualização do programa nunca passa por cima dela.</p>
                <div class="campo">
                  <textarea name="texto" style="min-height:260px">${esc(prompt.texto_mentora ?? prompt.texto_fabrica)}</textarea>
                </div>
                <div class="acoes">
                  <button type="submit">Salvar instruções</button>
                  ${prompt.texto_mentora ? `<a class="botao calmo" href="/setup/modulos/${n}/restaurar">Voltar ao texto de fábrica</a>` : ''}
                </div>
              </form>`
            : ''
        }
        ${listaPerg}
        <div class="acoes"><a class="botao calmo" href="/setup/modulos">Voltar aos módulos</a></div>`,
      ),
    );
  });

  app.post<{ Params: { n: string } }>('/setup/modulos/:n/material', async (req, res) => {
    const n = Number(req.params.n);
    const base = (await lerConfig<{ caminho: string }>('armazenamento'))?.caminho ?? '/dados/acervo';
    let nome = '';
    let texto: string | null = null;
    let caminho: string | null = null;
    let bytes = 0;
    let tipo = 'texto';

    const partes = (req as any).parts ? (req as any).parts() : null;
    if (partes) {
      for await (const parte of partes) {
        if (parte.type === 'file') {
          const buf = await parte.toBuffer();
          if (buf.length > 0) {
            const pasta = join(base, 'materiais', String(n));
            await mkdir(pasta, { recursive: true });
            const seguro = parte.filename.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
            caminho = join(pasta, `${Date.now()}-${seguro}`);
            await writeFile(caminho, buf);
            bytes = buf.length;
            tipo = 'arquivo';
            nome ||= parte.filename;
          }
        } else {
          const v = String(parte.value ?? '');
          if (parte.fieldname === 'texto' && v.trim()) texto = v.slice(0, 500_000);
          if (parte.fieldname === 'nome' && v.trim()) nome = v.trim().slice(0, 200);
        }
      }
    }

    if (!nome) nome = texto ? texto.slice(0, 60) + '…' : 'material sem nome';
    if (texto || caminho) {
      await q(
        'INSERT INTO materiais (modulo, nome, tipo, caminho, conteudo, bytes) VALUES ($1,$2,$3,$4,$5,$6)',
        [n, nome, tipo, caminho, texto, bytes],
      );
    }
    return res.redirect(`/setup/modulos/${n}`);
  });

  app.get<{ Params: { n: string; id: string } }>('/setup/modulos/:n/remover/:id', async (req, res) => {
    await q('DELETE FROM materiais WHERE id = $1', [req.params.id]);
    return res.redirect(`/setup/modulos/${Number(req.params.n)}`);
  });

  app.post<{ Params: { n: string }; Body: { texto: string } }>(
    '/setup/modulos/:n/instrucoes',
    async (req, res) => {
      const n = Number(req.params.n);
      await q(
        `UPDATE prompts SET texto_mentora = $2, versao_mentora = versao_mentora + 1,
                atualizado = now() WHERE slug = $1`,
        [`modulo-${n}`, req.body.texto ?? ''],
      );
      return res.redirect(`/setup/modulos/${n}`);
    },
  );

  app.get<{ Params: { n: string } }>('/setup/modulos/:n/restaurar', async (req, res) => {
    const n = Number(req.params.n);
    await q('UPDATE prompts SET texto_mentora = NULL, atualizado = now() WHERE slug = $1', [`modulo-${n}`]);
    return res.redirect(`/setup/modulos/${n}`);
  });

  app.post('/setup/modulos', async (_req, res) => {
    await concluir('modulos', {});
    return res.redirect('/setup');
  });

  // ------------------------------------------------------------- 8. consentimento
  const CAIXAS = [
    {
      chave: 'dados',
      titulo: 'Uso das respostas para gerar o diagnóstico',
      onde: 'Aparece no cadastro, antes de ela começar a responder.',
      rascunho:
        'Autorizo o uso das informações sobre o meu trabalho que eu preencher aqui para gerar o meu diagnóstico de posicionamento.',
    },
    {
      chave: 'guarda',
      titulo: 'Guardar o diagnóstico para revisitar',
      onde: 'Mesmo lugar. Serve para ela poder voltar aos 3 e aos 6 meses e comparar.',
      rascunho:
        'Autorizo guardar o meu diagnóstico por 24 meses, para que eu possa revisitá-lo e acompanhar a minha evolução.',
    },
    {
      chave: 'ia',
      titulo: 'Envio das respostas para a inteligência artificial',
      onde:
        'Mesmo lugar, e é obrigatória: sem ela não há diagnóstico. Precisa dizer qual provedor e em que país.',
      rascunho:
        'Entendo que as minhas respostas serão enviadas a um provedor de inteligência artificial, que pode estar fora do Brasil, para que o diagnóstico seja gerado.',
    },
    {
      chave: 'perfil',
      titulo: 'Análise de padrões para a mentora',
      onde:
        'Mesmo lugar, e esta é opcional: recusar não impede o diagnóstico. Ela pode ver a análise e revogar quando quiser.',
      rascunho:
        'Autorizo a geração de uma análise sobre a minha forma de trabalhar, para a minha mentora usar no acompanhamento. Sei que posso ver essa análise a qualquer momento e retirar esta autorização depois.',
    },
  ];

  app.get('/setup/consentimento', async (_req, res) => {
    const salvo = (await lerConfig<Record<string, string>>('consentimento_textos')) ?? {};
    const campos = CAIXAS.map(
      (c) => `<div class="campo">
        <label for="${c.chave}">${esc(c.titulo)}</label>
        <div class="dica">${esc(c.onde)}</div>
        <textarea id="${c.chave}" name="${c.chave}" required>${esc(salvo[c.chave] ?? c.rascunho)}</textarea>
      </div>`,
    ).join('');
    return res.type('text/html').send(
      molde(
        8,
        'Os textos de consentimento',
        `<p class="sub">Estes são os textos que cada mentorada vai ler e marcar antes de começar.
          Quem escreve é você: é a sua voz e é o seu risco. Os rascunhos abaixo são ponto de
          partida e podem ser reescritos inteiros.</p>
        <div class="aviso">Enquanto esta etapa não estiver concluída, o Hub não aceita cadastro de
          mentorada. Não dá para cadastrar alguém sob um consentimento que ainda não existe.</div>
        <form method="post" action="/setup/consentimento">
          ${campos}
          ${botoes('/setup', 'Salvar os textos')}
        </form>`,
      ),
    );
  });

  app.post<{ Body: Record<string, string> }>('/setup/consentimento', async (req, res) => {
    const textos: Record<string, string> = {};
    for (const c of CAIXAS) {
      const v = (req.body[c.chave] ?? '').trim();
      if (!v) {
        return res.type('text/html').send(
          molde(8, 'Os textos de consentimento',
            `<div class="erro">Faltou o texto de "${esc(c.titulo)}". Todos os quatro precisam estar preenchidos.</div>
             <div class="acoes"><a class="botao" href="/setup/consentimento">Voltar</a></div>`),
        );
      }
      textos[c.chave] = v.slice(0, 4000);
    }

    // O glossário vale também para texto fixo da interface, não só para saída de IA.
    const achados = verificarGlossario(Object.values(textos).join('\n'));
    if (achados.length) {
      const lista = achados
        .slice(0, 6)
        .map((a) => `<li>"${esc(a.proibida)}" — use ${esc(a.sugerida)}<br><small>${esc(a.trecho)}</small></li>`)
        .join('');
      return res.type('text/html').send(
        molde(8, 'Os textos de consentimento',
          `<div class="erro"><strong>Há palavras do glossário nos textos.</strong>
            <ul style="margin:8px 0 0 18px">${lista}</ul></div>
           <p class="sub">Os textos não foram salvos. Ajuste e envie de novo.</p>
           <div class="acoes"><a class="botao" href="/setup/consentimento">Voltar</a></div>`),
      );
    }

    const versao = new Date().toISOString().slice(0, 10) + '-' + Date.now().toString(36);
    await gravarConfig('consentimento_textos', textos);
    await gravarConfig('consentimento_versao', versao);
    await concluir('consentimento', { versao });
    return res.type('text/html').send(
      molde(8, 'Os textos de consentimento',
        `<div class="ok">Textos salvos na versão <strong>${esc(versao)}</strong>.
          A partir de agora fica registrado quem aceitou qual redação.</div>
         <div class="acoes"><a class="botao" href="/setup">Continuar</a></div>`),
    );
  });

  // ------------------------------------------------------------- 9. precificação
  app.get('/setup/precificacao', async (_req, res) => {
    const p = (await lerConfig<any>('precificacao')) ?? {
      vps_mes: 78,
      dolar: 5.4,
      custo_ia_diagnostico_usd: 0.35,
      outros_mes: 0,
      mentoradas_mes: 10,
      preco: 2500,
      trial_dias: 15,
    };
    return res.type('text/html').send(
      molde(
        9,
        'Custos e preço da sua mentoria',
        `<p class="sub">Uma coisa que a conta mostra logo de cara: o custo de inteligência
          artificial por diagnóstico é de centavos. O custo que pesa é o servidor, e ele é fixo.</p>
        <form method="post" action="/setup/precificacao">
          <h3>O que você paga</h3>
          <div class="campo"><label for="vps_mes">Servidor por mês, em reais</label>
            <input id="vps_mes" name="vps_mes" type="number" step="0.01" value="${esc(p.vps_mes)}">
            <div class="exemplo">Hostinger KVM 2 renova por R$ 77,99. O KVM 1 é mais barato mas aperta na hora de gerar o PDF.</div></div>
          <div class="campo"><label for="outros_mes">Outros custos fixos por mês</label>
            <input id="outros_mes" name="outros_mes" type="number" step="0.01" value="${esc(p.outros_mes)}">
            <div class="exemplo">Domínio, e-mail, o que mais houver.</div></div>
          <div class="campo"><label for="custo_ia_diagnostico_usd">Custo de IA por diagnóstico, em dólar</label>
            <input id="custo_ia_diagnostico_usd" name="custo_ia_diagnostico_usd" type="number" step="0.01" value="${esc(p.custo_ia_diagnostico_usd)}">
            <div class="exemplo">Entre 0,02 e 0,63 conforme o modelo. O Hub mede o real e atualiza isto depois.</div></div>
          <div class="campo"><label for="dolar">Dólar</label>
            <input id="dolar" name="dolar" type="number" step="0.01" value="${esc(p.dolar)}"></div>

          <h3>O que você cobra</h3>
          <div class="campo"><label for="preco">Preço da sua mentoria, por mentorada</label>
            <input id="preco" name="preco" type="number" step="0.01" value="${esc(p.preco)}"></div>
          <div class="campo"><label for="mentoradas_mes">Quantas mentoradas por mês</label>
            <input id="mentoradas_mes" name="mentoradas_mes" type="number" value="${esc(p.mentoradas_mes)}"></div>
          <div class="campo"><label for="trial_dias">Teste grátis, em dias</label>
            <input id="trial_dias" name="trial_dias" type="number" value="${esc(p.trial_dias)}">
            <div class="exemplo">Zero desliga o teste grátis. A cobrança em si ainda não está construída.</div></div>
          ${botoes('/setup', 'Calcular e salvar')}
        </form>`,
      ),
    );
  });

  app.post<{ Body: Record<string, string> }>('/setup/precificacao', async (req, res) => {
    const n = (k: string, padrao = 0) => {
      const v = Number(String(req.body[k] ?? '').replace(',', '.'));
      return Number.isFinite(v) ? v : padrao;
    };
    const dados = {
      vps_mes: n('vps_mes', 78),
      outros_mes: n('outros_mes'),
      custo_ia_diagnostico_usd: n('custo_ia_diagnostico_usd', 0.35),
      dolar: n('dolar', 5.4),
      preco: n('preco'),
      mentoradas_mes: Math.max(0, Math.round(n('mentoradas_mes'))),
      trial_dias: Math.max(0, Math.round(n('trial_dias'))),
    };

    const custoIaReais = dados.custo_ia_diagnostico_usd * dados.dolar;
    const custoFixo = dados.vps_mes + dados.outros_mes;
    const custoVariavel = custoIaReais * dados.mentoradas_mes;
    const receita = dados.preco * dados.mentoradas_mes;
    const lucro = receita - custoFixo - custoVariavel;
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    const custoPorMentorada = dados.mentoradas_mes > 0 ? custoFixo / dados.mentoradas_mes + custoIaReais : custoFixo;

    await gravarConfig('precificacao', dados);
    await concluir('precificacao', {});

    const brl = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

    return res.type('text/html').send(
      molde(
        9,
        'Custos e preço da sua mentoria',
        `<table>
          <tbody>
            <tr><td>Receita no mês</td><td class="num">${brl(receita)}</td></tr>
            <tr><td>Servidor e outros fixos</td><td class="num">− ${brl(custoFixo)}</td></tr>
            <tr><td>Inteligência artificial (${dados.mentoradas_mes} diagnósticos)</td><td class="num">− ${brl(custoVariavel)}</td></tr>
            <tr><td><strong>Sobra para você</strong></td><td class="num"><strong>${brl(lucro)}</strong></td></tr>
            <tr><td>Margem sobre o custo do sistema</td><td class="num">${margem.toFixed(1).replace('.', ',')}%</td></tr>
            <tr><td>Custo de sistema por mentorada</td><td class="num">${brl(custoPorMentorada)}</td></tr>
          </tbody>
        </table>
        <div class="aviso"><strong>Esta margem não é o seu lucro.</strong> Ela desconta só o que o
          programa custa para rodar: servidor e inteligência artificial. O seu tempo, que é o
          custo de verdade de uma mentoria, não está aqui. O número alto quer dizer uma coisa só,
          e é uma boa notícia: manter o sistema no ar custa quase nada perto do que você cobra.</div>
        <div class="aviso">Um diagnóstico inteiro consome ${brl(custoIaReais)} de inteligência
          artificial. O que pesa é o servidor, e ele custa o mesmo atendendo uma ou cinquenta.</div>
        ${
          dados.trial_dias > 0
            ? `<p class="sub">Teste grátis de ${dados.trial_dias} dias anotado. A cobrança ainda não
                está construída, então por enquanto isso é só um registro da sua decisão.</p>`
            : ''
        }
        <div class="acoes">
          <a class="botao" href="/setup">Continuar</a>
          <a class="botao calmo" href="/setup/precificacao">Mudar os números</a>
        </div>`,
      ),
    );
  });
}
