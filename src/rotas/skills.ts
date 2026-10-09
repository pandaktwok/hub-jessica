import type { FastifyInstance } from 'fastify';
import { q, um } from '../db.ts';
import { pagina, esc } from '../visao/layout.ts';
import { skillMd } from '../persona.ts';
import { molde, concluir, NUMERO } from './setup.ts';
import { MODULOS } from '../geracao.ts';

// Esta página só mostra. As skills dos módulos nascem no botão "Gerar PDF" de cada
// módulo (rotas/modulos.ts); a da voz nasce do perfil. Aqui ela e o Renan leem e baixam.

function pastaDoModulo(n: number | null): string {
  return n ? `modulo-${n}` : 'persona';
}

export default async function rotasSkills(app: FastifyInstance) {
  function exige(req: any, res: any) {
    if (!req.mentora) {
      res.redirect('/entrar');
      return false;
    }
    return true;
  }

  async function telaSkills(req: any, res: any) {
    if (!exige(req, res)) return;
    const todas = await q<any>(
      `SELECT id, nome, descricao, quando_usar, origem, modulo, revisada FROM skills ORDER BY coalesce(modulo, 0), nome`,
    );
    const aprovados = new Set(
      (await q<{ modulo: number }>('SELECT modulo FROM modulo_estado WHERE aprovado')).map((x) => Number(x.modulo)),
    );

    const linhaSkill = (s: any) => `<tr>
      <td><strong>${esc(s.nome)}</strong><br><small>${esc(s.descricao ?? '')}</small></td>
      <td><small>${esc(s.quando_usar ?? '')}</small></td>
      <td style="white-space:nowrap"><a href="/admin/skills/${esc(s.id)}">abrir</a> ·
        <a href="/admin/skills/${esc(s.id)}/arquivo.md">baixar .md</a></td>
    </tr>`;
    const tabela = (lista: any[]) =>
      `<table><thead><tr><th>Skill</th><th>Quando usar</th><th></th></tr></thead><tbody>${lista.map(linhaSkill).join('')}</tbody></table>`;

    const persona = todas.filter((s) => !s.modulo);
    const blocoPersona = `<div class="cartao"><h2>Voz do assistente</h2>
      ${persona.length ? tabela(persona) : '<p class="sub">Sai do seu perfil, na etapa 2.</p>'}</div>`;

    const porModulo = MODULOS.map((mod) => {
      const skills = todas.filter((s) => s.modulo === mod.numero);
      return `<div class="cartao">
        <h2>Módulo ${mod.numero} · ${esc(mod.titulo)} ${aprovados.has(mod.numero) ? '<span class="selo-aprovado">Aprovado</span>' : ''}</h2>
        ${
          skills.length
            ? tabela(skills)
            : `<p class="sub"><small>Ainda não há skill. Ela é escrita quando você clica em Gerar PDF no <a href="/setup/modulos/${mod.numero}">módulo ${mod.numero}</a>.</small></p>`
        }
      </div>`;
    }).join('');

    return res.type('text/html').send(
      molde(
        NUMERO.skills,
        'Skills',
        `<p class="sub">Aqui você só consulta. Cada módulo ganha a sua skill quando você gera o PDF dele, e
          cada nova geração reescreve a skill do zero. Os arquivos .md também são salvos na pasta do seu computador.</p>
        <div style="margin-top:26px">${blocoPersona}${porModulo}</div>
        <form method="post" action="/setup/skills/concluir">
          <div class="acoes"><button type="submit">Marcar esta etapa como concluída</button>
            <a class="botao calmo" href="/setup">Voltar</a></div>
        </form>`,
      ),
    );
  }

  app.get('/setup/skills', telaSkills);
  app.get('/admin/skills', telaSkills);

  app.post('/setup/skills/concluir', async (req: any, res) => {
    if (!exige(req, res)) return;
    await concluir('skills', {});
    return res.redirect('/setup');
  });

  app.get('/admin/skills/arquivos.json', async (req: any, res) => {
    if (!exige(req, res)) return;
    const todas = await q<any>('SELECT nome, descricao, quando_usar, instrucoes, modulo FROM skills ORDER BY nome');
    return res.send(
      todas.map((s) => ({
        caminho: `skills/${pastaDoModulo(s.modulo)}/${String(s.nome).replace(/[^\w.-]+/g, '-')}/SKILL.md`,
        conteudo: skillMd(s),
      })),
    );
  });

  app.get<{ Params: { id: string } }>('/admin/skills/:id/arquivo.md', async (req: any, res) => {
    if (!exige(req, res)) return;
    const s = await um<any>('SELECT nome, descricao, quando_usar, instrucoes FROM skills WHERE id = $1', [req.params.id]);
    if (!s) return res.callNotFound();
    return res
      .type('text/markdown; charset=utf-8')
      .header('content-disposition', `attachment; filename="${String(s.nome).replace(/[^\w.-]+/g, '-')}.md"`)
      .send(skillMd(s));
  });

  app.get<{ Params: { id: string } }>('/admin/skills/:id', async (req: any, res) => {
    if (!exige(req, res)) return;
    const s = await um<any>('SELECT * FROM skills WHERE id = $1', [req.params.id]);
    if (!s) return res.callNotFound();
    return res.type('text/html').send(
      pagina(
        { admin: true, titulo: s.nome, capa: { selo: 'Skill', titulo: s.nome } },
        `<div class="cartao">
          <p class="sub">${esc(s.descricao ?? '')}</p>
          <p class="sub"><small>Quando usar: ${esc(s.quando_usar ?? '—')}</small></p>
          <pre style="white-space:pre-wrap;font:inherit;line-height:1.6">${esc(s.instrucoes ?? '')}</pre>
          <div class="acoes"><a class="botao calmo" href="/admin/skills">Voltar</a>
            <a class="botao" href="/admin/skills/${esc(s.id)}/arquivo.md">Baixar .md</a></div>
          <p class="sub"><small>Origem: ${esc(s.origem)}${s.gerada_por ? `, por ${esc(s.gerada_por)}` : ''}.</small></p>
        </div>`,
      ),
    );
  });
}
