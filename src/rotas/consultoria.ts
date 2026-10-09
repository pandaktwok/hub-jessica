import type { FastifyInstance } from 'fastify';
import { q, um, lerConfig } from '../db.ts';
import { novoToken, hashToken } from '../auth.ts';
import { pagina, trilha, esc } from '../visao/layout.ts';
import { MODULOS, gerarModulo, gerarMapa } from '../geracao.ts';

const COOKIE = 'hj_mentorada';
const DIAS_14 = 14 * 24 * 60 * 60 * 1000;

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.COOKIE_SEGURO === 'true',
  maxAge: DIAS_14 / 1000,
};

interface Sessao {
  mentorada_id: string;
  nome: string;
  diagnostico_id: string;
}

async function sessao(token?: string): Promise<Sessao | null> {
  if (!token) return null;
  return um<Sessao>(
    `SELECT m.id AS mentorada_id, m.nome, d.id AS diagnostico_id
       FROM sessoes s
       JOIN mentoradas m ON m.id = s.mentorada_id
       JOIN diagnosticos d ON d.mentorada_id = m.id AND d.concluido_em IS NULL
      WHERE s.token_hash = $1 AND s.expira_em > now()`,
    [hashToken(token)],
  );
}

async function perfilMentora() {
  return (await lerConfig<any>('perfil')) ?? { nome: 'sua mentora', marca: '' };
}

/** Quais módulos já têm geração aceita. */
async function progresso(diagnosticoId: string) {
  const linhas = await q<{ modulo: number; estado: string }>(
    `SELECT DISTINCT ON (modulo) modulo, estado FROM geracoes
      WHERE diagnostico_id = $1 ORDER BY modulo, versao DESC`,
    [diagnosticoId],
  );
  const mapa = new Map(linhas.map((l) => [l.modulo, l.estado]));
  const aceitos = MODULOS.filter((m) => mapa.get(m.numero) === 'aceita').map((m) => m.numero);
  const proximo = MODULOS.find((m) => mapa.get(m.numero) !== 'aceita')?.numero ?? null;
  return { mapa, aceitos, proximo };
}

export default async function rotasConsultoria(app: FastifyInstance) {
  // ----------------------------------------------------------- entrada por link
  app.get<{ Params: { token: string } }>('/c/entrar/:token', async (req, res) => {
    const link = await um<{ id: string; mentorada_id: string }>(
      `SELECT id, mentorada_id FROM links_acesso
        WHERE token_hash = $1 AND expira_em > now() AND usado_em IS NULL`,
      [hashToken(req.params.token)],
    );
    if (!link) {
      return res.code(410).type('text/html').send(
        pagina(
          { titulo: 'Link expirado', escuro: true, capa: { titulo: 'Este link não vale mais' } },
          `<div class="cartao"><p class="sub">Links de acesso valem por pouco tempo e por um acesso só.
            Peça um novo para a sua mentora.</p></div>`,
        ),
      );
    }
    await q('UPDATE links_acesso SET usado_em = now() WHERE id = $1', [link.id]);

    // Garante que existe um diagnóstico aberto.
    await q(
      `INSERT INTO diagnosticos (mentorada_id) SELECT $1
        WHERE NOT EXISTS (SELECT 1 FROM diagnosticos WHERE mentorada_id = $1 AND concluido_em IS NULL)`,
      [link.mentorada_id],
    );

    const { claro, hash } = novoToken();
    await q('INSERT INTO sessoes (mentorada_id, token_hash, expira_em) VALUES ($1,$2,$3)', [
      link.mentorada_id,
      hash,
      new Date(Date.now() + DIAS_14),
    ]);
    res.setCookie(COOKIE, claro, cookieOpts);
    return res.redirect('/c');
  });

  // ----------------------------------------------------------- boas-vindas e lista
  app.get('/c', async (req: any, res) => {
    const s = await sessao(req.cookies?.[COOKIE]);
    if (!s) return res.code(401).type('text/html').send(semSessao());
    const p = await perfilMentora();
    const { mapa, aceitos, proximo } = await progresso(s.diagnostico_id);

    const itens = MODULOS.map((m) => {
      const estado = mapa.get(m.numero);
      const feito = estado === 'aceita';
      const agora = m.numero === proximo;
      return `<li>
        <span class="marca ${feito ? 'feita' : agora ? 'agora' : ''}">${feito ? '✓' : m.numero}</span>
        <span><span class="etapa-nome">${
          feito || agora ? `<a href="/c/modulo/${m.numero}">${esc(m.titulo)}</a>` : esc(m.titulo)
        }</span>${feito ? '<br><small>concluído</small>' : ''}</span>
      </li>`;
    }).join('');

    const tudoPronto = aceitos.length === MODULOS.length;

    return res.type('text/html').send(
      pagina(
        {
          titulo: 'Seu diagnóstico',
          capa: {
            selo: p.marca || 'Diagnóstico de posicionamento',
            titulo: aceitos.length === 0 ? `Olá, ${s.nome.split(' ')[0]}` : 'Seu diagnóstico',
            sub:
              aceitos.length === 0
                ? 'Seis blocos de perguntas sobre o seu trabalho. No fim, um mapa que é seu.'
                : `${aceitos.length} de ${MODULOS.length} concluídos`,
          },
        },
        `${
          aceitos.length === 0
            ? `<div class="cartao">
                <h2>O que você vai receber</h2>
                <p class="sub">Um Mapa de Diagnóstico com a sua cliente ideal, os seus diferenciais,
                  a sua mensagem, uma leitura da sua precificação, formatos de atendimento e os
                  próximos passos. Em PDF, para você guardar e mostrar a quem quiser.</p>
                <h3>Quanto leva</h3>
                <p class="sub">Entre 25 e 40 minutos no total. <strong>Você pode parar quando
                  quiser e voltar depois</strong> — tudo que você escrever fica salvo sozinho.</p>
                <h3>Como funciona</h3>
                <p class="sub">A cada bloco de perguntas, o sistema monta um rascunho a partir
                  do que você escreveu. Você lê, corrige o que não soar como você, e segue. O que
                  vale no fim é a sua versão, não a do sistema.</p>
              </div>`
            : ''
        }
        <div class="cartao">
          <ul class="lista-etapas">${itens}</ul>
          ${
            tudoPronto
              ? `<div class="acoes"><a class="botao" href="/c/mapa">Ver o seu Mapa</a></div>`
              : `<div class="acoes"><a class="botao" href="/c/modulo/${proximo}">${
                  aceitos.length === 0 ? 'Começar' : 'Continuar'
                }</a></div>`
          }
        </div>`,
      ),
    );
  });

  // ----------------------------------------------------------- formulário do módulo
  app.get<{ Params: { n: string } }>('/c/modulo/:n', async (req: any, res) => {
    const s = await sessao(req.cookies?.[COOKIE]);
    if (!s) return res.code(401).type('text/html').send(semSessao());
    const n = Number(req.params.n);
    const mod = MODULOS.find((m) => m.numero === n);
    if (!mod) return res.callNotFound();

    const aceita = await um(
      `SELECT id FROM geracoes WHERE diagnostico_id=$1 AND modulo=$2 AND estado='aceita' LIMIT 1`,
      [s.diagnostico_id, n],
    );
    if (aceita) return res.redirect(`/c/modulo/${n}/revisar`);

    const perguntas = await q<any>(
      'SELECT campo, rotulo, ajuda, exemplo, tipo, obrigatoria FROM perguntas WHERE modulo=$1 AND ativa ORDER BY ordem',
      [n],
    );
    const salvas = await q<{ campo: string; valor: string }>(
      'SELECT campo, valor FROM respostas WHERE diagnostico_id=$1 AND modulo=$2',
      [s.diagnostico_id, n],
    );
    const valores = new Map(salvas.map((r) => [r.campo, r.valor]));
    const ultimaMexida = await um<{ t: string }>(
      `SELECT to_char(max(salvo_em), 'DD/MM às HH24:MI') AS t FROM respostas
        WHERE diagnostico_id=$1 AND modulo=$2`,
      [s.diagnostico_id, n],
    );

    const campos = perguntas
      .map((p) => {
        const v = esc(valores.get(p.campo) ?? '');
        const entrada =
          p.tipo === 'numero'
            ? `<input id="${esc(p.campo)}" name="${esc(p.campo)}" type="number" step="any" value="${v}"${p.obrigatoria ? ' required' : ''}>`
            : p.tipo === 'texto_curto'
              ? `<input id="${esc(p.campo)}" name="${esc(p.campo)}" type="text" value="${v}"${p.obrigatoria ? ' required' : ''}>`
              : `<textarea id="${esc(p.campo)}" name="${esc(p.campo)}"${p.obrigatoria ? ' required' : ''}>${v}</textarea>`;
        return `<div class="campo">
          <label for="${esc(p.campo)}">${esc(p.rotulo)}</label>
          ${p.ajuda ? `<div class="dica">${esc(p.ajuda)}</div>` : ''}
          ${entrada}
          ${p.exemplo ? `<div class="exemplo">Por exemplo: ${esc(p.exemplo)}</div>` : ''}
        </div>`;
      })
      .join('');

    return res.type('text/html').send(
      pagina(
        { titulo: `${mod.titulo} — bloco ${n}`, capa: { selo: `Bloco ${n} de 6`, titulo: mod.titulo } },
        `${trilha(n, 6)}
        <div class="cartao">
          ${salvas.length ? `<p class="sub"><small>Rascunho salvo${ultimaMexida?.t ? ` em ${esc(ultimaMexida.t)}` : ''}.</small></p>` : ''}
          <form method="post" action="/c/modulo/${n}">
            ${campos}
            <div class="acoes">
              <button type="submit" name="acao" value="gerar">Concluir este bloco</button>
              <button type="submit" name="acao" value="salvar" class="botao calmo"
                style="background:transparent;color:var(--tinta);border-color:var(--linha)">Salvar e parar aqui</button>
            </div>
          </form>
        </div>
        <div class="passo-txt"><a href="/c">Voltar para a lista</a></div>`,
      ),
    );
  });

  app.post<{ Params: { n: string }; Body: Record<string, string> }>(
    '/c/modulo/:n',
    async (req: any, res) => {
      const s = await sessao(req.cookies?.[COOKIE]);
      if (!s) return res.code(401).type('text/html').send(semSessao());
      const n = Number(req.params.n);
      if (!MODULOS.some((m) => m.numero === n)) return res.callNotFound();

      const perguntas = await q<{ campo: string; obrigatoria: boolean }>(
        'SELECT campo, obrigatoria FROM perguntas WHERE modulo=$1 AND ativa',
        [n],
      );
      for (const p of perguntas) {
        const v = (req.body[p.campo] ?? '').trim();
        if (!v) continue;
        await q(
          `INSERT INTO respostas (diagnostico_id, modulo, campo, valor) VALUES ($1,$2,$3,$4)
           ON CONFLICT (diagnostico_id, modulo, campo)
           DO UPDATE SET valor = EXCLUDED.valor, salvo_em = now()`,
          [s.diagnostico_id, n, p.campo, v.slice(0, 20_000)],
        );
      }

      if (req.body.acao === 'salvar') return res.redirect('/c');

      const faltando = perguntas.filter((p) => p.obrigatoria && !(req.body[p.campo] ?? '').trim());
      if (faltando.length) return res.redirect(`/c/modulo/${n}`);

      await gerarModulo(s.diagnostico_id, n);
      return res.redirect(`/c/modulo/${n}/gerando`);
    },
  );

  // ----------------------------------------------------------- a tela dos 30 segundos
  app.get<{ Params: { n: string } }>('/c/modulo/:n/gerando', async (req: any, res) => {
    const s = await sessao(req.cookies?.[COOKIE]);
    if (!s) return res.code(401).type('text/html').send(semSessao());
    const n = Number(req.params.n);
    const mod = MODULOS.find((m) => m.numero === n);
    if (!mod) return res.callNotFound();

    // Ela relê as próprias palavras em vez de encarar um girador.
    const suas = await q<{ rotulo: string; valor: string }>(
      `SELECT p.rotulo, r.valor FROM respostas r
         JOIN perguntas p ON p.modulo=r.modulo AND p.campo=r.campo
        WHERE r.diagnostico_id=$1 AND r.modulo=$2 ORDER BY p.ordem`,
      [s.diagnostico_id, n],
    );
    const eco = suas
      .map((r) => `<h3>${esc(r.rotulo)}</h3><p class="sub">${esc(r.valor)}</p>`)
      .join('');

    return res.type('text/html').send(
      pagina(
        { titulo: 'Lendo o que você escreveu', capa: { selo: `Bloco ${n} de 6`, titulo: 'Lendo o que você escreveu' } },
        `<div class="cartao">
          <p class="sub" id="aviso">Estou lendo o que você contou sobre ${esc(mod.titulo.toLowerCase())}
            e montando o rascunho. Costuma levar menos de meio minuto.</p>
          <div id="tarde" style="display:none">
            <div class="aviso">Está demorando mais que o normal. Suas respostas já estão salvas —
              se preferir, pare aqui e volte depois.</div>
            <div class="acoes"><a class="botao calmo" href="/c">Parar e voltar depois</a></div>
          </div>
        </div>
        <div class="cartao">
          <h2>O que você escreveu</h2>
          ${eco}
        </div>
        <script>
          const alvo = ${JSON.stringify(`/c/modulo/${n}/estado`)};
          let voltas = 0;
          async function olhar(){
            voltas++;
            if (voltas > 15) document.getElementById('tarde').style.display = 'block';
            try {
              const r = await fetch(alvo, { headers: { accept: 'application/json' } });
              const d = await r.json();
              if (d.estado === 'rascunho') { location.href = ${JSON.stringify(`/c/modulo/${n}/revisar`)}; return; }
              if (d.estado === 'falhou')   { location.href = ${JSON.stringify(`/c/modulo/${n}/erro`)}; return; }
            } catch (e) { /* rede oscilando: tenta de novo */ }
            setTimeout(olhar, 3000);
          }
          setTimeout(olhar, 2500);
        </script>`,
      ),
    );
  });

  app.get<{ Params: { n: string } }>('/c/modulo/:n/estado', async (req: any, res) => {
    const s = await sessao(req.cookies?.[COOKIE]);
    if (!s) return res.code(401).send({ erro: 'sem sessão' });
    const g = await um<{ estado: string }>(
      `SELECT estado FROM geracoes WHERE diagnostico_id=$1 AND modulo=$2
        ORDER BY versao DESC LIMIT 1`,
      [s.diagnostico_id, Number(req.params.n)],
    );
    return res.send({ estado: g?.estado ?? 'gerando' });
  });

  app.get<{ Params: { n: string } }>('/c/modulo/:n/erro', async (req: any, res) => {
    const s = await sessao(req.cookies?.[COOKIE]);
    if (!s) return res.code(401).type('text/html').send(semSessao());
    const n = Number(req.params.n);
    const g = await um<{ erro: string; clinico_ok: boolean }>(
      `SELECT erro, clinico_ok FROM geracoes WHERE diagnostico_id=$1 AND modulo=$2
        ORDER BY versao DESC LIMIT 1`,
      [s.diagnostico_id, n],
    );
    const p = await perfilMentora();
    const bloqueio = g && g.clinico_ok === false;
    return res.type('text/html').send(
      pagina(
        { titulo: 'Precisa de revisão', capa: { selo: `Bloco ${n} de 6`, titulo: 'Isto precisa passar por uma pessoa' } },
        `<div class="cartao">
          ${
            bloqueio
              ? `<p class="sub">O rascunho deste bloco encostou em assunto clínico, e por regra o
                  sistema não mostra isso sem ${esc(p.nome)} olhar antes. Ela já foi avisada.</p>
                 <p class="sub">Suas respostas estão salvas. Você pode seguir para o próximo bloco
                  enquanto isso.</p>`
              : `<p class="sub">Não consegui montar o rascunho agora. Suas respostas estão salvas,
                  nada se perdeu.</p>`
          }
          <div class="acoes">
            ${bloqueio ? '' : `<a class="botao" href="/c/modulo/${n}/regerar">Tentar de novo</a>`}
            <a class="botao calmo" href="/c">Voltar para a lista</a>
          </div>
        </div>`,
      ),
    );
  });

  // ----------------------------------------------------------- revisão
  app.get<{ Params: { n: string } }>('/c/modulo/:n/revisar', async (req: any, res) => {
    const s = await sessao(req.cookies?.[COOKIE]);
    if (!s) return res.code(401).type('text/html').send(semSessao());
    const n = Number(req.params.n);
    const mod = MODULOS.find((m) => m.numero === n);
    if (!mod) return res.callNotFound();

    const g = await um<any>(
      `SELECT id, conteudo, conteudo_editado, estado, versao, glossario_ok FROM geracoes
        WHERE diagnostico_id=$1 AND modulo=$2 ORDER BY versao DESC LIMIT 1`,
      [s.diagnostico_id, n],
    );
    if (!g) return res.redirect(`/c/modulo/${n}`);
    if (g.estado === 'gerando') return res.redirect(`/c/modulo/${n}/gerando`);
    if (g.estado === 'falhou') return res.redirect(`/c/modulo/${n}/erro`);

    const p = await perfilMentora();
    const conteudo = g.conteudo_editado ?? g.conteudo;
    const aceita = g.estado === 'aceita';
    const proximo = n < 6 ? n + 1 : null;

    return res.type('text/html').send(
      pagina(
        { titulo: `${mod.titulo} — rascunho`, capa: { selo: `Bloco ${n} de 6`, titulo: mod.titulo } },
        `${trilha(n, 6)}
        <div class="cartao">
          <!-- O enquadramento vem ANTES do texto na ordem do documento, de propósito:
               lido primeiro, inclusive por leitor de tela. -->
          <div class="aviso"><strong>Isto é um rascunho.</strong> ${esc(p.nome)} vai revisar com
            você. Ajuste o que não soar como você — o que vale é a sua versão.</div>
          ${
            g.glossario_ok === false
              ? `<div class="aviso"><small>Este texto usou uma palavra que ${esc(p.nome)} prefere
                  evitar. Ela já foi avisada e você pode corrigir aqui.</small></div>`
              : ''
          }
          ${renderConteudo(conteudo)}
        </div>
        ${
          aceita
            ? `<div class="cartao"><div class="ok">Bloco concluído.</div>
                <div class="acoes">
                  ${proximo ? `<a class="botao" href="/c/modulo/${proximo}">Ir para o bloco ${proximo}</a>` : `<a class="botao" href="/c/mapa">Ver o seu Mapa</a>`}
                  <a class="botao calmo" href="/c">Lista de blocos</a>
                </div></div>`
            : `<div class="cartao">
                <form method="post" action="/c/modulo/${n}/aceitar">
                  <h3>Quer mudar alguma coisa?</h3>
                  <p class="sub">Reescreva o que não soar como você. O que ficar aqui é o que vai
                    para o seu Mapa.</p>
                  ${camposEditaveis(conteudo)}
                  <div class="acoes">
                    <button type="submit">Está bom, seguir</button>
                    <a class="botao calmo" href="/c/modulo/${n}/regerar">Montar outro rascunho</a>
                  </div>
                </form>
              </div>`
        }
        <div class="passo-txt"><a href="/c">Voltar para a lista</a></div>`,
      ),
    );
  });

  app.post<{ Params: { n: string }; Body: { editado: string } }>(
    '/c/modulo/:n/aceitar',
    async (req: any, res) => {
      const s = await sessao(req.cookies?.[COOKIE]);
      if (!s) return res.code(401).type('text/html').send(semSessao());
      const n = Number(req.params.n);
      const g = await um<{ id: string; conteudo: any }>(
        `SELECT id, conteudo FROM geracoes WHERE diagnostico_id=$1 AND modulo=$2
          ORDER BY versao DESC LIMIT 1`,
        [s.diagnostico_id, n],
      );
      if (!g) return res.redirect(`/c/modulo/${n}`);

      const editado = remontar(req.body, g.conteudo);
      const mudou = editado && JSON.stringify(editado) !== JSON.stringify(g.conteudo);
      if (mudou) {
        // Histórico de verdade: geracoes não é append-only, edicoes é.
        await q('INSERT INTO edicoes (geracao_id, conteudo) VALUES ($1, $2)', [
          g.id,
          JSON.stringify(editado),
        ]);
      }
      await q(
        `UPDATE geracoes SET estado='aceita', conteudo_editado = $2 WHERE id = $1`,
        [g.id, mudou ? JSON.stringify(editado) : null],
      );
      return res.redirect(n < 6 ? `/c/modulo/${n + 1}` : '/c/mapa');
    },
  );

  app.get<{ Params: { n: string } }>('/c/modulo/:n/regerar', async (req: any, res) => {
    const s = await sessao(req.cookies?.[COOKIE]);
    if (!s) return res.code(401).type('text/html').send(semSessao());
    const n = Number(req.params.n);
    await gerarModulo(s.diagnostico_id, n);
    return res.redirect(`/c/modulo/${n}/gerando`);
  });

  // ----------------------------------------------------------- o Mapa
  app.get('/c/mapa', async (req: any, res) => {
    const s = await sessao(req.cookies?.[COOKIE]);
    if (!s) return res.code(401).type('text/html').send(semSessao());
    const { aceitos } = await progresso(s.diagnostico_id);
    if (aceitos.length < MODULOS.length) return res.redirect('/c');

    const p = await perfilMentora();
    let mapa = await um<{ id: string; conteudo: any; estado: string }>(
      `SELECT id, conteudo, estado FROM mapas WHERE diagnostico_id=$1
        ORDER BY iniciado_em DESC LIMIT 1`,
      [s.diagnostico_id],
    );

    if (!mapa || mapa.estado === 'falhou') {
      await gerarMapa(s.diagnostico_id);
      mapa = { id: '', conteudo: null, estado: 'gerando' };
    }

    if (mapa.estado === 'gerando') {
      return res.type('text/html').send(
        pagina(
          { titulo: 'Montando o seu Mapa', capa: { selo: 'Quase lá', titulo: 'Montando o seu Mapa' } },
          `<div class="cartao"><p class="sub">Estou juntando os seis blocos num documento só.
            Leva um pouco mais que os anteriores.</p></div>
          <script>setTimeout(()=>location.reload(), 4000)</script>`,
        ),
      );
    }

    await q(
      `UPDATE diagnosticos SET concluido_em = coalesce(concluido_em, now()) WHERE id = $1`,
      [s.diagnostico_id],
    );

    return res.type('text/html').send(
      pagina(
        {
          titulo: 'Seu Mapa de Diagnóstico',
          capa: {
            selo: p.marca || 'Diagnóstico de posicionamento',
            titulo: 'Seu Mapa de Diagnóstico',
            sub: esc(s.nome),
          },
        },
        `<div class="cartao">${renderConteudo(mapa.conteudo)}</div>
         <div class="cartao">
           <p class="sub">Este documento é seu. ${esc(p.nome)} vai usá-lo como ponto de partida
             no acompanhamento.</p>
           <div class="acoes">
             <button onclick="window.print()">Salvar em PDF ou imprimir</button>
             <a class="botao calmo" href="/c">Rever os blocos</a>
           </div>
         </div>`,
      ),
    );
  });

  function semSessao() {
    return pagina(
      { titulo: 'Acesso', escuro: true, capa: { titulo: 'Preciso de um link de acesso' } },
      `<div class="cartao"><p class="sub">Peça para a sua mentora enviar o link do seu diagnóstico.</p></div>`,
    );
  }
}

function rotuloDe(chave: string): string {
  return chave.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());
}

/**
 * Campos de edição em português, um por item, em vez de uma caixa com JSON cru.
 * Ela é médica, não programadora: chave e colchete não podem aparecer na tela dela.
 *
 * Cada campo carrega o tipo no próprio nome para a remontagem saber o que fazer:
 *   txt__chave    texto simples
 *   lst__chave    lista, um item por linha
 *   obj__chave    estrutura aninhada, editada como texto corrido
 */
function camposEditaveis(c: any): string {
  if (c === null || typeof c !== 'object' || Array.isArray(c)) {
    return `<div class="campo"><label for="txt__texto">O texto</label>
      <textarea id="txt__texto" name="txt__texto">${esc(typeof c === 'string' ? c : JSON.stringify(c))}</textarea></div>`;
  }

  return Object.entries(c)
    .map(([k, v]) => {
      const id = `_${k}`;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        const curto = String(v).length < 90;
        const entrada = curto
          ? `<input id="${esc(id)}" name="txt__${esc(k)}" type="text" value="${esc(String(v))}">`
          : `<textarea id="${esc(id)}" name="txt__${esc(k)}">${esc(String(v))}</textarea>`;
        return `<div class="campo"><label for="${esc(id)}">${esc(rotuloDe(k))}</label>${entrada}</div>`;
      }
      if (Array.isArray(v) && v.every((i) => typeof i === 'string' || typeof i === 'number')) {
        return `<div class="campo"><label for="${esc(id)}">${esc(rotuloDe(k))}</label>
          <div class="dica">Um por linha. Apague a linha para tirar o item.</div>
          <textarea id="${esc(id)}" name="lst__${esc(k)}">${esc(v.join('\n'))}</textarea></div>`;
      }
      // Estrutura aninhada: cada item vira um bloco de texto separado por linha em branco.
      const itens = Array.isArray(v) ? v : [v];
      const texto = itens
        .map((i: any) =>
          typeof i === 'object' && i !== null
            ? Object.entries(i)
                .map(([k2, v2]) => `${rotuloDe(k2)}: ${Array.isArray(v2) ? v2.join('; ') : v2}`)
                .join('\n')
            : String(i),
        )
        .join('\n\n');
      return `<div class="campo"><label for="${esc(id)}">${esc(rotuloDe(k))}</label>
        <div class="dica">Separe cada item por uma linha em branco.</div>
        <textarea id="${esc(id)}" name="obj__${esc(k)}" style="min-height:160px">${esc(texto)}</textarea></div>`;
    })
    .join('');
}

/** Remonta o objeto a partir dos campos, preservando a forma do original. */
function remontar(corpo: Record<string, string>, original: any): any {
  const chaves = Object.keys(corpo).filter((k) => /^(txt|lst|obj)__/.test(k));
  if (!chaves.length) return null;

  if (chaves.length === 1 && chaves[0] === 'txt__texto' && typeof original !== 'object') {
    return (corpo['txt__texto'] ?? '').trim();
  }

  const saida: Record<string, any> = {};
  for (const campo of chaves) {
    const tipo = campo.slice(0, 3);
    const chave = campo.slice(5);
    const valor = corpo[campo] ?? '';
    if (tipo === 'txt') {
      const antes = original?.[chave];
      saida[chave] =
        typeof antes === 'number' && valor.trim() !== '' && Number.isFinite(Number(valor))
          ? Number(valor)
          : typeof antes === 'boolean'
            ? valor === 'true'
            : valor.trim();
    } else if (tipo === 'lst') {
      saida[chave] = valor
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    } else {
      // Blocos separados por linha em branco, cada linha "Rótulo: valor".
      const blocos = valor
        .split(/\n\s*\n/)
        .map((b) => b.trim())
        .filter(Boolean);
      const reconstruidos = blocos.map((b) => {
        const obj: Record<string, string> = {};
        let solto = '';
        for (const linha of b.split('\n')) {
          const m = linha.match(/^([^:]{1,60}):\s*(.*)$/);
          if (m) obj[m[1].trim().toLowerCase().replace(/\s+/g, '_')] = m[2].trim();
          else solto += (solto ? ' ' : '') + linha.trim();
        }
        if (solto) obj.texto = solto;
        return Object.keys(obj).length ? obj : b;
      });
      saida[chave] = Array.isArray(original?.[chave]) ? reconstruidos : reconstruidos[0] ?? '';
    }
  }
  return saida;
}

/** Renderiza o JSON do modelo de um jeito legível, sem assumir formato fixo. */
function renderConteudo(c: any, nivel = 0): string {
  if (c === null || c === undefined) return '';
  if (typeof c === 'string') return `<p class="sub">${esc(c)}</p>`;
  if (typeof c === 'number' || typeof c === 'boolean') return `<p class="sub">${esc(String(c))}</p>`;
  if (Array.isArray(c)) {
    return `<ul style="margin:6px 0 10px 20px">${c
      .map((i) => `<li style="margin-bottom:6px">${typeof i === 'object' ? renderConteudo(i, nivel + 1) : esc(String(i))}</li>`)
      .join('')}</ul>`;
  }
  return Object.entries(c)
    .map(([k, v]) => {
      const rotulo = k.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());
      const tag = nivel === 0 ? 'h3' : 'strong';
      return `<${tag}>${esc(rotulo)}</${tag}>${renderConteudo(v, nivel + 1)}`;
    })
    .join('');
}
