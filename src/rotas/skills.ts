import type { FastifyInstance } from 'fastify';
import { q, um, lerConfig } from '../db.ts';
import { pagina, esc } from '../visao/layout.ts';
import { gerar, configIA } from '../ia/index.ts';
import { parseSaida, MODULOS } from '../geracao.ts';

// A IA que gera as skills recebe só o material e a tarefa. Nada sobre para onde as
// skills vão depois: isso é decisão de quem revisa, não contexto que muda a geração.
// O registro da revisão fica em docs/REVISAR-SKILLS.md e no CLAUDE.md.
const SISTEMA_GERADOR = `Você extrai método de documentos e transforma em instruções operacionais reutilizáveis.

Dado o material de referência de um especialista, identifique os procedimentos que ele usa
de verdade e escreva cada um como uma instrução que outra pessoa conseguiria seguir sem ter
lido o material.

Regras:
- Tire o método do material, não do seu conhecimento geral sobre o assunto.
- Cada instrução precisa ser específica o bastante para mudar o resultado de quem segue.
  "Seja empático" não serve. "Peça o exemplo de uma cliente real antes de generalizar" serve.
- Use as palavras do especialista quando ele tiver um jeito próprio de nomear as coisas.
- Se o material não sustentar nenhuma instrução, devolva lista vazia. Não invente.
- Escreva em português do Brasil.`;

function tarefa(modulo: number, titulo: string, material: string, instrucoes: string) {
  return `## Material de referência
${material}

## O que este módulo faz
Módulo ${modulo} — ${titulo}.
${instrucoes}

## Sua tarefa
Extraia de 2 a 5 procedimentos deste material.

Devolva apenas JSON, sem texto antes nem depois, sem cercas de código:
{"skills":[{"nome":"identificador-curto-com-hifens","descricao":"uma linha dizendo o que faz","quando_usar":"em que situação isto se aplica","instrucoes":"o procedimento, em passos, do jeito que o especialista faz"}]}`;
}

export default async function rotasSkills(app: FastifyInstance) {
  function exige(req: any, res: any) {
    if (!req.mentora) {
      res.redirect('/entrar');
      return false;
    }
    return true;
  }

  app.get('/admin/skills', async (req: any, res) => {
    if (!exige(req, res)) return;

    const todas = await q<any>(
      `SELECT id, nome, descricao, quando_usar, origem, modulo, revisada, gerada_por
         FROM skills ORDER BY coalesce(modulo, 99), nome`,
    );
    const materiais = await q<{ modulo: number; n: string }>(
      `SELECT coalesce(modulo,0) AS modulo, count(*)::text AS n
         FROM materiais WHERE conteudo IS NOT NULL GROUP BY 1`,
    );
    const temMaterial = new Map(materiais.map((m) => [Number(m.modulo), Number(m.n)]));

    const porModulo = MODULOS.map((mod) => {
      const skills = todas.filter((s) => s.modulo === mod.numero);
      const mats = temMaterial.get(mod.numero) ?? 0;
      const lista = skills.length
        ? `<table><thead><tr><th>Skill</th><th>Quando usar</th><th></th></tr></thead><tbody>
            ${skills
              .map(
                (s) => `<tr>
                  <td><strong>${esc(s.nome)}</strong><br><small>${esc(s.descricao ?? '')}</small></td>
                  <td><small>${esc(s.quando_usar ?? '')}</small></td>
                  <td><a href="/admin/skills/${esc(s.id)}">ver</a></td>
                </tr>`,
              )
              .join('')}
          </tbody></table>`
        : `<p class="sub"><small>Nenhuma skill gerada para este módulo ainda.</small></p>`;

      return `<div class="cartao">
        <h2>${mod.numero}. ${esc(mod.titulo)}</h2>
        <p class="sub"><small>${mats} ${mats === 1 ? 'material com texto' : 'materiais com texto'}
          ${mats === 0 ? '— suba material em <a href="/setup/modulos/' + mod.numero + '">módulos</a> antes de gerar' : ''}</small></p>
        ${lista}
        ${
          mats > 0
            ? `<form method="post" action="/admin/skills/gerar/${mod.numero}">
                <div class="acoes"><button type="submit">${skills.length ? 'Gerar de novo' : 'Gerar skills deste módulo'}</button></div>
              </form>`
            : ''
        }
      </div>`;
    }).join('');

    const soltas = todas.filter((s) => !s.modulo);
    return res.type('text/html').send(
      pagina(
        { titulo: 'Skills', capa: { selo: 'Painel', titulo: 'Skills' } },
        `<div class="cartao">
          <p class="sub">As skills saem do material que você subiu em cada módulo. Elas descrevem
            o seu método de um jeito que o sistema consegue seguir.</p>
          <p class="sub"><small>Gerar de novo substitui as skills daquele módulo. As suas edições
            manuais se perdem, então revise antes de regerar.</small></p>
        </div>
        ${porModulo}
        ${
          soltas.length
            ? `<div class="cartao"><h2>Outras skills</h2>
                <table><tbody>${soltas
                  .map((s) => `<tr><td>${esc(s.nome)}</td><td><small>${esc(s.origem)}</small></td></tr>`)
                  .join('')}</tbody></table></div>`
            : ''
        }
        <div class="passo-txt"><a href="/admin">Voltar ao painel</a></div>`,
      ),
    );
  });

  app.post<{ Params: { n: string } }>('/admin/skills/gerar/:n', async (req: any, res) => {
    if (!exige(req, res)) return;
    const n = Number(req.params.n);
    const mod = MODULOS.find((m) => m.numero === n);
    if (!mod) return res.callNotFound();

    const mats = await q<{ nome: string; conteudo: string }>(
      `SELECT nome, conteudo FROM materiais
        WHERE coalesce(modulo,0) IN (0,$1) AND conteudo IS NOT NULL
        ORDER BY (coalesce(modulo,0)=$1) DESC, criado_em`,
      [n],
    );
    if (!mats.length) return res.redirect('/admin/skills');

    let material = '';
    for (const m of mats) {
      const bloco = `\n--- ${m.nome} ---\n${m.conteudo}\n`;
      if (material.length + bloco.length > 30_000) break;
      material += bloco;
    }

    const p = await um<{ texto_fabrica: string; texto_mentora: string | null }>(
      'SELECT texto_fabrica, texto_mentora FROM prompts WHERE slug = $1',
      [`modulo-${n}`],
    );
    const instrucoes = p?.texto_mentora ?? p?.texto_fabrica ?? '';

    let erro: string | null = null;
    let criadas = 0;
    try {
      const cfg = await configIA();
      const r = await gerar(
        { sistema: SISTEMA_GERADOR, usuario: tarefa(n, mod.titulo, material, instrucoes), maxTokens: 4000 },
        cfg,
      );
      const saida = parseSaida(r.texto);
      const lista: any[] = Array.isArray(saida?.skills) ? saida.skills : [];

      await q('DELETE FROM skills WHERE modulo = $1 AND origem = $2', [n, 'gerada']);
      for (const s of lista.slice(0, 8)) {
        const nome = String(s?.nome ?? '').trim().slice(0, 120);
        if (!nome) continue;
        await q(
          `INSERT INTO skills (nome, descricao, quando_usar, instrucoes, origem, modulo, gerada_por, revisada)
           VALUES ($1,$2,$3,$4,'gerada',$5,$6,false)
           ON CONFLICT (nome) DO UPDATE SET descricao=EXCLUDED.descricao,
             quando_usar=EXCLUDED.quando_usar, instrucoes=EXCLUDED.instrucoes,
             modulo=EXCLUDED.modulo, gerada_por=EXCLUDED.gerada_por, revisada=false,
             atualizado=now()`,
          [
            nome,
            String(s?.descricao ?? '').slice(0, 500),
            String(s?.quando_usar ?? '').slice(0, 500),
            String(s?.instrucoes ?? '').slice(0, 20_000),
            n,
            `${r.provedor}/${r.modelo}`,
          ],
        );
        criadas++;
      }
    } catch (e: any) {
      erro = String(e?.message ?? e).slice(0, 400);
    }

    return res.type('text/html').send(
      pagina(
        { titulo: 'Skills', capa: { selo: 'Painel', titulo: `Módulo ${n} — ${mod.titulo}` } },
        `<div class="cartao">
          ${
            erro
              ? `<div class="erro">Não consegui gerar: ${esc(erro)}</div>`
              : criadas
                ? `<div class="ok">${criadas} ${criadas === 1 ? 'skill gerada' : 'skills geradas'} a partir do seu material.</div>
                   <p class="sub">Vale ler e ajustar: o que saiu é o que a inteligência artificial
                     entendeu do seu material, não necessariamente o que você quis dizer.</p>`
                : `<div class="aviso">A inteligência artificial não achou procedimento suficiente
                     no material deste módulo. Suba mais referência e tente de novo.</div>`
          }
          <div class="acoes"><a class="botao" href="/admin/skills">Ver as skills</a></div>
        </div>`,
      ),
    );
  });

  app.get<{ Params: { id: string } }>('/admin/skills/:id', async (req: any, res) => {
    if (!exige(req, res)) return;
    const s = await um<any>('SELECT * FROM skills WHERE id = $1', [req.params.id]);
    if (!s) return res.callNotFound();
    return res.type('text/html').send(
      pagina(
        { titulo: s.nome, capa: { selo: 'Skill', titulo: s.nome } },
        `<div class="cartao">
          <form method="post" action="/admin/skills/${esc(s.id)}">
            <div class="campo"><label for="descricao">O que faz</label>
              <input id="descricao" name="descricao" type="text" value="${esc(s.descricao ?? '')}"></div>
            <div class="campo"><label for="quando_usar">Quando usar</label>
              <input id="quando_usar" name="quando_usar" type="text" value="${esc(s.quando_usar ?? '')}"></div>
            <div class="campo"><label for="instrucoes">O procedimento</label>
              <textarea id="instrucoes" name="instrucoes" style="min-height:320px">${esc(s.instrucoes ?? s.conteudo ?? '')}</textarea></div>
            <div class="acoes"><button type="submit">Salvar</button>
              <a class="botao calmo" href="/admin/skills">Voltar</a></div>
          </form>
          <p class="sub"><small>Origem: ${esc(s.origem)}${s.gerada_por ? `, por ${esc(s.gerada_por)}` : ''}.</small></p>
        </div>`,
      ),
    );
  });

  app.post<{ Params: { id: string }; Body: any }>('/admin/skills/:id', async (req: any, res) => {
    if (!exige(req, res)) return;
    await q(
      `UPDATE skills SET descricao=$2, quando_usar=$3, instrucoes=$4, revisada=true, atualizado=now()
        WHERE id=$1`,
      [
        req.params.id,
        String(req.body.descricao ?? '').slice(0, 500),
        String(req.body.quando_usar ?? '').slice(0, 500),
        String(req.body.instrucoes ?? '').slice(0, 20_000),
      ],
    );
    return res.redirect('/admin/skills');
  });
}
