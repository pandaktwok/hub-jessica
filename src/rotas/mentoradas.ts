import type { FastifyInstance } from 'fastify';
import { q, um, lerConfig } from '../db.ts';
import { novoToken } from '../auth.ts';
import { pagina, esc } from '../visao/layout.ts';
import { MODULOS } from '../geracao.ts';
import { consentimentoPronto } from './setup.ts';

const MIN_30 = 30 * 60 * 1000;

export default async function rotasMentoradas(app: FastifyInstance) {
  function exige(req: any, res: any) {
    if (!req.mentora) {
      res.redirect('/entrar');
      return false;
    }
    return true;
  }

  // ----------------------------------------------------------- lista
  app.get('/admin/mentoradas', async (req: any, res) => {
    if (!exige(req, res)) return;

    const linhas = await q<any>(
      `SELECT m.id, m.nome, m.email, m.status, m.consentimento_perfil,
              d.id AS diagnostico_id, d.concluido_em,
              (SELECT count(*) FROM geracoes g
                WHERE g.diagnostico_id = d.id AND g.estado = 'aceita') AS modulos_ok,
              to_char(greatest(
                coalesce((SELECT max(salvo_em) FROM respostas r WHERE r.diagnostico_id = d.id), m.iniciou_em),
                m.iniciou_em), 'DD/MM HH24:MI') AS ultima_mexida
         FROM mentoradas m
         LEFT JOIN diagnosticos d ON d.mentorada_id = m.id AND d.concluido_em IS NULL
        ORDER BY m.iniciou_em DESC`,
    );

    const corpo = linhas.length
      ? `<table>
          <thead><tr><th>Mentorada</th><th>Onde está</th><th>Última mexida</th><th></th></tr></thead>
          <tbody>${linhas
            .map((l) => {
              const feitos = Number(l.modulos_ok ?? 0);
              const onde = l.concluido_em
                ? 'concluído'
                : feitos === 0
                  ? 'ainda não começou'
                  : feitos >= MODULOS.length
                    ? 'no Mapa'
                    : `bloco ${feitos + 1} de ${MODULOS.length}`;
              return `<tr>
                <td>${esc(l.nome)}<br><small>${esc(l.email)}</small></td>
                <td>${esc(onde)}</td>
                <td><small>${esc(l.ultima_mexida ?? '')}</small></td>
                <td><a href="/admin/mentoradas/${esc(l.id)}">abrir</a></td>
              </tr>`;
            })
            .join('')}</tbody>
        </table>`
      : '<p class="sub">Nenhuma mentorada cadastrada ainda.</p>';

    const pronto = await consentimentoPronto();

    return res.type('text/html').send(
      pagina(
        { titulo: 'Mentoradas', capa: { selo: 'Painel', titulo: 'Mentoradas' } },
        `<div class="cartao">${corpo}</div>
        <div class="cartao">
          <h2>Cadastrar</h2>
          ${
            pronto
              ? `<form method="post" action="/admin/mentoradas">
                  <div class="campo"><label for="nome">Nome dela</label>
                    <input id="nome" name="nome" type="text" required></div>
                  <div class="campo"><label for="email">E-mail dela</label>
                    <input id="email" name="email" type="email" required></div>
                  <div class="acoes"><button type="submit">Cadastrar e gerar o link</button></div>
                </form>`
              : `<div class="aviso"><strong>Os textos de consentimento ainda não foram escritos.</strong>
                  Não dá para cadastrar alguém sob um consentimento que não existe.
                  <br><a href="/setup/consentimento">Escrever agora</a></div>`
          }
        </div>
        <div class="passo-txt"><a href="/admin">Voltar ao painel</a></div>`,
      ),
    );
  });

  // ----------------------------------------------------------- cadastro
  app.post<{ Body: { nome: string; email: string } }>('/admin/mentoradas', async (req: any, res) => {
    if (!exige(req, res)) return;
    if (!(await consentimentoPronto())) return res.redirect('/setup/consentimento');

    const nome = (req.body.nome ?? '').trim();
    const email = (req.body.email ?? '').trim().toLowerCase();
    if (!nome || !email) return res.redirect('/admin/mentoradas');

    const versao = (await lerConfig<string>('consentimento_versao')) ?? 'sem-versao';

    const m = await um<{ id: string }>(
      `INSERT INTO mentoradas (nome, email, consentimento_versao) VALUES ($1,$2,$3)
       ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [nome, email, versao],
    );
    await q(
      `INSERT INTO diagnosticos (mentorada_id) SELECT $1
        WHERE NOT EXISTS (SELECT 1 FROM diagnosticos WHERE mentorada_id=$1 AND concluido_em IS NULL)`,
      [m!.id],
    );
    return res.redirect(`/admin/mentoradas/${m!.id}/link`);
  });

  // ----------------------------------------------------------- link de acesso
  app.get<{ Params: { id: string } }>('/admin/mentoradas/:id/link', async (req: any, res) => {
    if (!exige(req, res)) return;
    const m = await um<{ nome: string; email: string }>(
      'SELECT nome, email FROM mentoradas WHERE id = $1',
      [req.params.id],
    );
    if (!m) return res.callNotFound();

    const { claro, hash } = novoToken();
    await q(
      'INSERT INTO links_acesso (mentorada_id, token_hash, expira_em) VALUES ($1,$2,$3)',
      [req.params.id, hash, new Date(Date.now() + MIN_30)],
    );
    const base = (process.env.URL_PUBLICA ?? `http://${req.headers.host}`).replace(/\/$/, '');
    const link = `${base}/c/entrar/${claro}`;

    return res.type('text/html').send(
      pagina(
        { titulo: 'Link de acesso', capa: { selo: 'Painel', titulo: `Link para ${esc(m.nome)}` } },
        `<div class="cartao">
          <div class="aviso">Este link vale por <strong>30 minutos</strong> e por um acesso só.
            Depois que ela entrar, a sessão dela dura duas semanas.</div>
          <div class="campo">
            <label for="link">Copie e mande para ela</label>
            <input id="link" type="text" value="${esc(link)}" readonly onclick="this.select()">
          </div>
          <p class="sub"><small>O envio automático por e-mail ainda não está ligado. Por enquanto
            é copiar e mandar pelo canal que você já usa com ela.</small></p>
          <div class="acoes">
            <a class="botao" href="/admin/mentoradas">Voltar para a lista</a>
            <a class="botao calmo" href="/admin/mentoradas/${esc(req.params.id)}/link">Gerar outro link</a>
          </div>
        </div>`,
      ),
    );
  });

  // ----------------------------------------------------------- ficha
  app.get<{ Params: { id: string } }>('/admin/mentoradas/:id', async (req: any, res) => {
    if (!exige(req, res)) return;
    const m = await um<any>(
      `SELECT m.*, d.id AS diagnostico_id FROM mentoradas m
         LEFT JOIN diagnosticos d ON d.mentorada_id = m.id
        WHERE m.id = $1 ORDER BY d.criado_em DESC LIMIT 1`,
      [req.params.id],
    );
    if (!m) return res.callNotFound();

    const gs = m.diagnostico_id
      ? await q<any>(
          `SELECT DISTINCT ON (modulo) modulo, estado, versao, glossario_ok, clinico_ok,
                  custo_centavos, erro
             FROM geracoes WHERE diagnostico_id = $1 ORDER BY modulo, versao DESC`,
          [m.diagnostico_id],
        )
      : [];

    const alertas = gs.filter((g) => g.clinico_ok === false || g.glossario_ok === false);

    const tabela = MODULOS.map((mod) => {
      const g = gs.find((x) => x.modulo === mod.numero);
      const estado = !g
        ? '—'
        : g.estado === 'aceita'
          ? 'aceito por ela'
          : g.estado === 'gerando'
            ? 'gerando'
            : g.estado === 'falhou'
              ? (g.clinico_ok === false ? 'BLOQUEADO: conteúdo clínico' : 'falhou')
              : 'rascunho esperando ela';
      return `<tr><td>${mod.numero}. ${esc(mod.titulo)}</td><td>${esc(estado)}</td>
        <td class="num">${g?.versao ? `v${g.versao}` : ''}</td></tr>`;
    }).join('');

    return res.type('text/html').send(
      pagina(
        { titulo: m.nome, capa: { selo: 'Mentorada', titulo: m.nome, sub: m.email } },
        `${
          alertas.length
            ? `<div class="cartao"><div class="aviso"><strong>Há ${alertas.length}
                ${alertas.length === 1 ? 'geração que precisa' : 'gerações que precisam'} do seu olho.</strong>
                ${alertas.some((a) => a.clinico_ok === false)
                  ? ' Uma delas foi bloqueada por encostar em assunto clínico e não foi mostrada a ela.'
                  : ' Uma delas usou palavra do glossário.'}</div></div>`
            : ''
        }
        <div class="cartao">
          <h2>Os seis blocos</h2>
          <table><thead><tr><th>Bloco</th><th>Estado</th><th></th></tr></thead>
            <tbody>${tabela}</tbody></table>
        </div>
        <div class="cartao">
          <h2>Consentimento</h2>
          <table><tbody>
            <tr><td>Versão aceita</td><td>${esc(m.consentimento_versao)}</td></tr>
            <tr><td>Análise de padrões</td><td>${
              m.perfil_revogado_em ? 'revogada por ela' : m.consentimento_perfil ? 'autorizada' : 'não autorizada'
            }</td></tr>
          </tbody></table>
        </div>
        <div class="acoes">
          <a class="botao" href="/admin/mentoradas/${esc(m.id)}/link">Gerar link de acesso</a>
          <a class="botao calmo" href="/admin/mentoradas">Voltar</a>
        </div>`,
      ),
    );
  });
}
