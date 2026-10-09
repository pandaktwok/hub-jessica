import type { FastifyInstance } from 'fastify';
import { q, um, lerConfig } from '../db.ts';
import { pagina, esc } from '../visao/layout.ts';
import { skillMd } from '../persona.ts';
import { molde, concluir, NUMERO } from './setup.ts';
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

function tarefa(modulo: number, titulo: string, material: string, instrucoes: string, exemplo: string) {
  return `## Material de referência
${material}
${exemplo}
## O que este módulo faz
Módulo ${modulo} — ${titulo}.
${instrucoes}

## Sua tarefa
Extraia de 2 a 5 procedimentos deste material.

Devolva apenas JSON, sem texto antes nem depois, sem cercas de código:
{"skills":[{"nome":"identificador-curto-com-hifens","descricao":"uma linha dizendo o que faz","quando_usar":"em que situação isto se aplica","instrucoes":"o procedimento, em passos, do jeito que o especialista faz"}]}`;
}


function pastaDoModulo(n: number | null): string {
  return n ? `modulo-${n}` : 'persona';
}

/** Monta, do exemplo preenchido pela mentora, o trecho que mostra o que se espera do módulo. */
async function trechoExemplo(n: number): Promise<string> {
  const rs = await q<{ rotulo: string; valor: string }>(
    `SELECT p.rotulo, e.valor FROM exemplos e JOIN perguntas p ON p.modulo = e.modulo AND p.campo = e.campo
      WHERE e.modulo = $1 AND btrim(e.valor) <> '' ORDER BY p.ordem`,
    [n],
  );
  const saida = await um<{ conteudo: any }>(
    "SELECT conteudo FROM exemplo_saidas WHERE modulo = $1 AND estado = 'pronto'",
    [n],
  );
  if (!rs.length) return '';
  return `
## Exemplo de preenchimento deste módulo
${rs.map((r) => `${r.rotulo}\n${r.valor}`).join('\n\n')}
${saida ? `\n## O que a IA gerou a partir desse exemplo\n${JSON.stringify(saida.conteudo, null, 1).slice(0, 6000)}\n` : ''}`;
}

export async function gerarSkillsDoModulo(n: number): Promise<{ criadas: number; erro: string | null; vazio: boolean }> {
  const mod = MODULOS.find((m) => m.numero === n);
  if (!mod) return { criadas: 0, erro: 'módulo inválido', vazio: false };

  const mats = await q<{ nome: string; conteudo: string }>(
    `SELECT nome || coalesce(' (citação: ' || citacao || ')', '') AS nome, conteudo FROM materiais
      WHERE coalesce(modulo,0) IN (0,$1) AND conteudo IS NOT NULL
      ORDER BY (coalesce(modulo,0)=$1) DESC, criado_em`,
    [n],
  );
  const exemplo = await trechoExemplo(n);
  if (!mats.length && !exemplo) return { criadas: 0, erro: null, vazio: true };

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

  try {
    const cfg = await configIA();
    const r = await gerar(
      { sistema: SISTEMA_GERADOR, usuario: tarefa(n, mod.titulo, material || '(sem documentos)', instrucoes, exemplo), maxTokens: 4000 },
      cfg,
    );
    const saida = parseSaida(r.texto);
    const lista: any[] = Array.isArray(saida?.skills) ? saida.skills : [];

    await q('DELETE FROM skills WHERE modulo = $1 AND origem = $2', [n, 'gerada']);
    let criadas = 0;
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
          typeof s?.instrucoes === 'string' ? s.instrucoes.slice(0, 20_000) : JSON.stringify(s?.instrucoes ?? '').slice(0, 20_000),
          n,
          `${r.provedor}/${r.modelo}`,
        ],
      );
      criadas++;
    }
    return { criadas, erro: null, vazio: false };
  } catch (e: any) {
    return { criadas: 0, erro: String(e?.message ?? e).slice(0, 400), vazio: false };
  }
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
      `SELECT id, nome, descricao, quando_usar, origem, modulo, revisada
         FROM skills ORDER BY coalesce(modulo, 0), nome`,
    );
    const base = await q<{ modulo: number; n: string }>(
      `SELECT modulo, count(*)::text AS n FROM (
          SELECT coalesce(modulo,0) AS modulo FROM materiais WHERE conteudo IS NOT NULL
          UNION ALL SELECT modulo FROM exemplos WHERE btrim(valor) <> ''
        ) t GROUP BY 1`,
    );
    const temBase = new Map(base.map((m) => [Number(m.modulo), Number(m.n)]));
    const geral = temBase.get(0) ?? 0;

    const linhaSkill = (s: any) => `<tr>
      <td><strong>${esc(s.nome)}</strong><br><small>${esc(s.descricao ?? '')}</small></td>
      <td><small>${esc(s.quando_usar ?? '')}</small></td>
      <td style="white-space:nowrap"><a href="/admin/skills/${esc(s.id)}">abrir</a> ·
        <a href="/admin/skills/${esc(s.id)}/arquivo.md">baixar .md</a></td>
    </tr>`;
    const tabela = (lista: any[]) =>
      `<table><thead><tr><th>Skill</th><th>Quando usar</th><th></th></tr></thead><tbody>${lista.map(linhaSkill).join('')}</tbody></table>`;

    const persona = todas.filter((s) => !s.modulo);
    const blocoPersona = `<div class="cartao">
      <h2>Voz do assistente</h2>
      ${persona.length ? tabela(persona) : '<p class="sub">Sai do seu perfil, na etapa 2.</p>'}
    </div>`;

    const porModulo = MODULOS.map((mod) => {
      const skills = todas.filter((s) => s.modulo === mod.numero);
      const podeGerar = (temBase.get(mod.numero) ?? 0) + geral > 0;
      return `<div class="cartao">
        <h2>Módulo ${mod.numero} · ${esc(mod.titulo)}</h2>
        ${skills.length ? tabela(skills) : '<p class="sub"><small>Nenhuma skill gerada para este módulo ainda.</small></p>'}
        ${
          podeGerar
            ? `<form method="post" action="/admin/skills/gerar/${mod.numero}">
                <div class="acoes" style="margin-top:12px"><button type="submit" class="calmo pequeno">${skills.length ? 'Gerar de novo' : 'Gerar as skills deste módulo'}</button></div>
              </form>`
            : `<p class="sub"><small>Responda as perguntas ou suba documentos em <a href="/setup/modulos/${mod.numero}">Módulo ${mod.numero}</a> antes de gerar.</small></p>`
        }
      </div>`;
    }).join('');

    return res.type('text/html').send(
      molde(
        NUMERO.skills,
        'Skills geradas',
        `<p class="sub">Aqui ficam os arquivos .md que o programa escreveu a partir das suas respostas e dos
          seus documentos, um conjunto por módulo. Você não preenche nada: só abre, lê e, se quiser, baixa.</p>
        <div class="acoes">
          <form method="post" action="/admin/skills/gerar-todas" style="display:inline"><button type="submit">Gerar as skills de todos os módulos</button></form>
          <button type="button" class="calmo" id="salvar-todas">Salvar tudo na minha pasta</button>
        </div>
        <div id="msg-pasta"></div>
        <script>
          document.getElementById('salvar-todas').addEventListener('click',function(){
            var m=document.getElementById('msg-pasta');
            fetch('/admin/skills/arquivos.json').then(function(r){return r.json()}).then(function(l){
              if(!l.length)throw new Error('Ainda não há skills para salvar.');
              return hubPasta.escrever(l).then(function(n){return [n,l.length]})
            }).then(function(r){m.innerHTML='<div class="ok"></div>';m.firstChild.textContent=r[1]+' arquivo(s) salvo(s) na pasta '+r[0]+'.'})
            .catch(function(e){m.innerHTML='<div class="erro"></div>';m.firstChild.textContent=(e.message||e)+' Escolha a pasta em "Pasta", no topo, ou baixe um por um.'});
          });
        </script>
        <p class="sub" style="margin-top:14px"><small>Regerar substitui as skills daquele módulo. Edições feitas à mão se perdem.</small></p>
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

  app.post<{ Params: { n: string } }>('/admin/skills/gerar/:n', async (req: any, res) => {
    if (!exige(req, res)) return;
    const n = Number(req.params.n);
    const mod = MODULOS.find((m) => m.numero === n);
    if (!mod) return res.callNotFound();
    const r = await gerarSkillsDoModulo(n);

    return res.type('text/html').send(
      molde(
        NUMERO.skills,
        `Módulo ${n} · ${mod.titulo}`,
        `${
          r.erro
            ? `<div class="erro">Não consegui gerar: ${esc(r.erro)}</div>`
            : r.vazio
              ? `<div class="aviso">Não há nada para ler neste módulo ainda. Responda as perguntas ou suba documentos.</div>`
              : r.criadas
                ? `<div class="ok">${r.criadas} ${r.criadas === 1 ? 'skill gerada' : 'skills geradas'}.</div>
                   <p class="sub">Vale ler: o que saiu é o que a inteligência artificial entendeu do seu material,
                     não necessariamente o que você quis dizer.</p>`
                : `<div class="aviso">A inteligência artificial não achou procedimento suficiente. Suba mais referência e tente de novo.</div>`
        }
        <div class="acoes"><a class="botao" href="/admin/skills">Ver as skills</a></div>`,
      ),
    );
  });

  app.post('/admin/skills/gerar-todas', async (req: any, res) => {
    if (!exige(req, res)) return;
    const linhas: string[] = [];
    for (const mod of MODULOS) {
      const r = await gerarSkillsDoModulo(mod.numero);
      linhas.push(
        `<tr><td>${mod.numero}. ${esc(mod.titulo)}</td><td>${
          r.erro ? `<span style="color:var(--erro)">${esc(r.erro)}</span>` : r.vazio ? 'sem material' : `${r.criadas} skill(s)`
        }</td></tr>`,
      );
    }
    return res.type('text/html').send(
      molde(
        NUMERO.skills,
        'Skills geradas',
        `<table><tbody>${linhas.join('')}</tbody></table>
         <div class="acoes"><a class="botao" href="/admin/skills">Ver as skills</a></div>`,
      ),
    );
  });

  // Todos os arquivos, prontos para o navegador gravar na pasta dela.
  app.get('/admin/skills/arquivos.json', async (req: any, res) => {
    if (!exige(req, res)) return;
    const todas = await q<any>('SELECT nome, descricao, quando_usar, instrucoes, modulo FROM skills ORDER BY nome');
    const arquivos = todas.map((s) => ({
      caminho: `skills/${pastaDoModulo(s.modulo)}/${String(s.nome).replace(/[^\w.-]+/g, '-')}/SKILL.md`,
      conteudo: skillMd(s),
    }));
    return res.send(arquivos);
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
          <form method="post" action="/admin/skills/${esc(s.id)}">
            <div class="campo"><label for="descricao">O que faz</label>
              <input id="descricao" name="descricao" type="text" value="${esc(s.descricao ?? '')}"></div>
            <div class="campo"><label for="quando_usar">Quando usar</label>
              <input id="quando_usar" name="quando_usar" type="text" value="${esc(s.quando_usar ?? '')}"></div>
            <div class="campo"><label for="instrucoes">O procedimento</label>
              <textarea id="instrucoes" name="instrucoes" style="min-height:320px">${esc(s.instrucoes ?? s.conteudo ?? '')}</textarea></div>
            <div class="acoes"><button type="submit">Salvar</button>
              <a class="botao calmo" href="/admin/skills">Voltar</a>
              <a class="botao calmo" href="/admin/skills/${esc(s.id)}/arquivo.md">Baixar .md</a></div>
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
