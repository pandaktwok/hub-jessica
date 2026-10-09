import type { FastifyInstance } from 'fastify';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { q, um, lerConfig } from '../db.ts';
import { esc } from '../visao/layout.ts';
import { anonimizar, textoDoPdf } from '../anonimizar.ts';
import { MODULOS, gerarExemplo } from '../geracao.ts';
import { pdfExemplo } from '../pdf.ts';
import { molde, concluir, botoes, NUMERO } from './setup.ts';

interface Pergunta {
  campo: string;
  rotulo: string;
  ajuda: string | null;
  exemplo: string | null;
  tipo: string;
  opcoes: string[] | null;
  obrigatoria: boolean;
}

function campo(p: Pergunta, valor: string): string {
  const id = `p_${p.campo}`;
  const nome = `r_${p.campo}`;
  let entrada: string;
  if (p.tipo === 'numero') {
    entrada = `<input id="${id}" name="${nome}" type="number" step="any" value="${esc(valor)}" placeholder="${esc(p.exemplo ?? '')}">`;
  } else if (p.tipo === 'texto_curto') {
    entrada = `<input id="${id}" name="${nome}" type="text" value="${esc(valor)}" placeholder="${esc(p.exemplo ?? '')}">`;
  } else if (p.tipo === 'escolha' && Array.isArray(p.opcoes)) {
    entrada = `<select id="${id}" name="${nome}"><option value=""></option>${p.opcoes
      .map((o) => `<option${o === valor ? ' selected' : ''}>${esc(o)}</option>`)
      .join('')}</select>`;
  } else {
    entrada = `<textarea id="${id}" name="${nome}" placeholder="${esc(p.exemplo ?? '')}">${esc(valor)}</textarea>`;
  }
  return `<div class="campo">
    <label for="${id}">${esc(p.rotulo)}${p.obrigatoria ? '' : ' <small>(opcional)</small>'}</label>
    ${p.ajuda ? `<div class="dica">${esc(p.ajuda)}</div>` : ''}
    ${entrada}
  </div>`;
}

export default async function rotasModulos(app: FastifyInstance) {
  function exige(req: any, res: any) {
    if (!req.mentora) {
      res.redirect('/entrar');
      return false;
    }
    return true;
  }
  const valido = (n: number) => Number.isInteger(n) && n >= 1 && n <= 6;

  // ------------------------------------------------------------- lista
  app.get('/setup/modulos', async (req: any, res) => {
    if (!exige(req, res)) return;
    const perg = await q<{ modulo: number; n: string }>(
      'SELECT modulo, count(*)::text AS n FROM perguntas WHERE ativa GROUP BY 1',
    );
    const resp = await q<{ modulo: number; n: string }>(
      "SELECT modulo, count(*)::text AS n FROM exemplos WHERE btrim(valor) <> '' GROUP BY 1",
    );
    const docs = await q<{ modulo: number; n: string }>(
      'SELECT modulo, count(*)::text AS n FROM materiais WHERE modulo BETWEEN 1 AND 6 GROUP BY 1',
    );
    const saidas = await q<{ modulo: number; estado: string }>('SELECT modulo, estado FROM exemplo_saidas');
    const mapa = (l: { modulo: number; n: string }[]) => new Map(l.map((x) => [Number(x.modulo), Number(x.n)]));
    const P = mapa(perg), R = mapa(resp), D = mapa(docs);
    const S = new Map(saidas.map((s) => [Number(s.modulo), s.estado]));

    const linhas = MODULOS.map((m) => {
      const total = P.get(m.numero) ?? 0;
      const feitas = R.get(m.numero) ?? 0;
      const pdf = S.get(m.numero) === 'pronto';
      const pronto = pdf;
      return `<li>
        <span class="marca ${pronto ? 'feita' : ''}">${String(m.numero).padStart(2, '0')}</span>
        <span><span class="etapa-nome"><a href="/setup/modulos/${m.numero}">${esc(m.titulo)}</a></span><br>
          <small>${feitas} de ${total} perguntas respondidas · ${D.get(m.numero) ?? 0} documento(s) ·
          ${pdf ? 'PDF de exemplo gerado' : 'PDF de exemplo ainda não gerado'}</small></span>
      </li>`;
    }).join('');

    return res.type('text/html').send(
      molde(
        NUMERO.modulos,
        'Os seis módulos',
        `<p class="sub">Para cada módulo você faz três coisas: responde as perguntas de entrada como se
          fosse uma mentorada, sobe os documentos que embasam o módulo (livros, consultas já feitas)
          e gera um PDF com o que a IA responderia. Você lê o PDF, me diz o que ajustar, e as skills
          são geradas a partir disso.</p>
        <ul class="lista-etapas">${linhas}</ul>
        <form method="post" action="/setup/modulos">
          ${botoes('/setup', 'Marcar esta etapa como concluída')}
        </form>`,
      ),
    );
  });

  app.post('/setup/modulos', async (req: any, res) => {
    if (!exige(req, res)) return;
    await concluir('modulos', {});
    return res.redirect('/setup');
  });

  // ------------------------------------------------------------- um módulo
  app.get<{ Params: { n: string }; Querystring: { erro?: string; ok?: string } }>(
    '/setup/modulos/:n',
    async (req: any, res) => {
      if (!exige(req, res)) return;
      const n = Number(req.params.n);
      if (!valido(n)) return res.callNotFound();
      const mod = MODULOS.find((m) => m.numero === n)!;

      const perguntas = await q<Pergunta>(
        `SELECT campo, rotulo, ajuda, exemplo, tipo, opcoes, obrigatoria
           FROM perguntas WHERE modulo = $1 AND ativa ORDER BY ordem`,
        [n],
      );
      const respostas = await q<{ campo: string; valor: string }>(
        'SELECT campo, valor FROM exemplos WHERE modulo = $1',
        [n],
      );
      const valores = new Map(respostas.map((r) => [r.campo, r.valor]));
      const docs = await q<any>(
        'SELECT id, nome, tipo, citacao, anonimizado FROM materiais WHERE modulo = $1 ORDER BY criado_em',
        [n],
      );
      const saida = await um<any>(
        `SELECT estado, erro, provedor, modelo, custo_centavos,
                to_char(gerado_em, 'DD/MM HH24:MI') AS quando
           FROM exemplo_saidas WHERE modulo = $1`,
        [n],
      );

      const listaDocs = docs.length
        ? `<table><thead><tr><th>Documento</th><th>Citação</th><th></th></tr></thead><tbody>
            ${docs
              .map(
                (d: any) => `<tr>
                <td>${esc(d.nome)}${d.anonimizado ? ' <span class="etiqueta">anonimizado</span>' : ''}</td>
                <td><small>${esc(d.citacao ?? '—')}</small></td>
                <td><form method="post" action="/setup/modulos/${n}/remover/${esc(d.id)}" style="display:inline">
                  <button type="submit" class="calmo pequeno">Remover</button></form></td></tr>`,
              )
              .join('')}
          </tbody></table>`
        : '<p class="sub">Nenhum documento ainda.</p>';

      const blocoSaida = !saida
        ? `<p class="sub">Ainda não foi gerado. Responda as perguntas acima, salve, e gere.</p>`
        : saida.estado === 'pronto'
          ? `<div class="ok">Exemplo gerado em ${esc(saida.quando)}${saida.modelo ? ` por ${esc(saida.provedor)} / ${esc(saida.modelo)}` : ''}.</div>
             <div class="acoes">
               <a class="botao" href="/setup/modulos/${n}/exemplo.pdf" target="_blank">Abrir o PDF</a>
               <button type="button" class="calmo" id="salvar-pdf">Salvar na minha pasta</button>
             </div>
             <div id="msg-pasta"></div>`
          : `<div class="erro">${esc(saida.erro ?? 'Não deu para gerar.')}</div>`;

      const flash = req.query.erro
        ? `<div class="erro">${esc(String(req.query.erro).slice(0, 300))}</div>`
        : req.query.ok
          ? `<div class="ok">${esc(String(req.query.ok).slice(0, 200))}</div>`
          : '';

      return res.type('text/html').send(
        molde(
          NUMERO.modulos,
          `${n}. ${mod.titulo}`,
          `${flash}
          <h2>1 · Perguntas de entrada</h2>
          <p class="sub">São as perguntas que a mentorada vai responder. Responda como se fosse uma
            cliente sua: isto vira o exemplo de preenchimento.</p>
          <form method="post" action="/setup/modulos/${n}/respostas">
            ${perguntas.map((p) => campo(p, valores.get(p.campo) ?? '')).join('')}
            <div class="acoes"><button type="submit">Salvar as respostas</button></div>
          </form>

          <h3 style="margin-top:44px">2 · Documentos</h3>
          <p class="sub">Livros e referências que embasam este módulo, ou consultas que você já fez como
            exemplo de preenchimento. Pode subir vários, um de cada vez ou juntos.</p>
          ${listaDocs}
          <form method="post" action="/setup/modulos/${n}/material" enctype="multipart/form-data">
            <div class="campo"><label>Que tipo de documento é</label>
              <div class="escolhas">
                <label><input type="radio" name="tipo_doc" value="referencia" checked>Livro ou referência</label>
                <label><input type="radio" name="tipo_doc" value="consulta">Consulta que já fiz (anonimizar)</label>
              </div></div>
            <div class="campo"><label for="arquivo">Arquivos</label>
              <div class="dica">PDF, texto ou markdown. Até 20 MB cada.</div>
              <input id="arquivo" name="arquivo" type="file" multiple></div>
            <div class="campo"><label for="texto">Ou cole um texto</label>
              <textarea id="texto" name="texto"></textarea></div>
            <div class="campo"><label for="nome">Nome do documento</label>
              <input id="nome" name="nome" type="text" placeholder="Por exemplo: StoryBrand, capítulo sobre o guia"></div>
            <div class="campo"><div class="escolhas"><label><input type="checkbox" id="quer-citacao" name="quer_citacao" value="1">Adicionar citação do documento</label></div>
              <div id="bloco-citacao" style="display:none;margin-top:12px">
                <input id="citacao" name="citacao" type="text" placeholder="Páginas 12 a 18, capítulo 3">
                <div class="exemplo">Indique de onde o programa deve tirar: páginas, capítulo, trecho.</div>
              </div></div>
            <div class="acoes"><button type="submit">Adicionar documento</button></div>
          </form>

          <h3 style="margin-top:44px" id="exemplo">3 · PDF de exemplo do que a IA gera</h3>
          <p class="sub">A IA lê as suas respostas e os documentos e escreve o que escreveria para uma
            mentorada. Isto usa a inteligência artificial conectada.</p>
          ${blocoSaida}
          <form method="post" action="/setup/modulos/${n}/exemplo">
            <div class="acoes"><button type="submit" ${respostas.some((r) => r.valor.trim()) ? '' : 'disabled'}>${saida?.estado === 'pronto' ? 'Gerar de novo' : 'Gerar o PDF de exemplo'}</button>
              <a class="botao calmo" href="/setup/modulos">Voltar aos módulos</a></div>
          </form>
          <script>
            (function(){
              var c=document.getElementById('quer-citacao'),b=document.getElementById('bloco-citacao');
              c.addEventListener('change',function(){b.style.display=c.checked?'block':'none'});
              var s=document.getElementById('salvar-pdf');
              if(s)s.addEventListener('click',function(){
                var m=document.getElementById('msg-pasta');
                fetch('/setup/modulos/${n}/exemplo.pdf').then(function(r){return r.blob()}).then(function(blob){
                  return hubPasta.escrever([{caminho:'pdfs/modulo-${n}-exemplo.pdf',blob:blob}])
                }).then(function(nome){m.innerHTML='<div class="ok">Salvo na pasta <strong></strong>.</div>';m.querySelector('strong').textContent=nome})
                .catch(function(e){m.innerHTML='<div class="erro"></div>';m.firstChild.textContent=(e.message||e)+' Escolha a pasta em "Pasta", no topo, ou abra o PDF e baixe.'});
              });
            })();
          </script>`,
        ),
      );
    },
  );

  // ------------------------------------------------------------- respostas de exemplo
  app.post<{ Params: { n: string }; Body: Record<string, string> }>(
    '/setup/modulos/:n/respostas',
    async (req: any, res) => {
      if (!exige(req, res)) return;
      const n = Number(req.params.n);
      if (!valido(n)) return res.callNotFound();
      const perguntas = await q<{ campo: string }>(
        'SELECT campo FROM perguntas WHERE modulo = $1 AND ativa',
        [n],
      );
      for (const p of perguntas) {
        const v = String(req.body?.[`r_${p.campo}`] ?? '').trim().slice(0, 8000);
        await q(
          `INSERT INTO exemplos (modulo, campo, valor) VALUES ($1,$2,$3)
           ON CONFLICT (modulo, campo) DO UPDATE SET valor = EXCLUDED.valor, salvo_em = now()`,
          [n, p.campo, v],
        );
      }
      return res.redirect(`/setup/modulos/${n}?ok=${encodeURIComponent('Respostas salvas.')}`);
    },
  );

  // ------------------------------------------------------------- documentos
  app.post<{ Params: { n: string } }>('/setup/modulos/:n/material', async (req: any, res) => {
    if (!exige(req, res)) return;
    const n = Number(req.params.n);
    if (!valido(n)) return res.callNotFound();
    const base = (await lerConfig<{ caminho: string }>('armazenamento'))?.caminho ?? '/dados/acervo';

    const campos: Record<string, string> = {};
    const arquivos: { nome: string; buf: Buffer }[] = [];
    for await (const parte of (req as any).parts()) {
      if (parte.type === 'file') {
        const buf = await parte.toBuffer();
        if (buf.length > 0) arquivos.push({ nome: parte.filename, buf });
      } else {
        campos[parte.fieldname] = String(parte.value ?? '');
      }
    }

    const consulta = campos.tipo_doc === 'consulta';
    const citacao = campos.quer_citacao && campos.citacao?.trim() ? campos.citacao.trim().slice(0, 300) : null;
    const avisos: string[] = [];
    let anonimizados = 0;

    async function guardar(nome: string, texto: string | null, caminho: string | null, bytes: number, anonimo: boolean, removidos: Record<string, number>) {
      await q(
        `INSERT INTO materiais (modulo, nome, tipo, caminho, conteudo, bytes, anonimizado, removidos, citacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [n, nome, caminho ? 'arquivo' : 'texto', caminho, texto, bytes, anonimo, JSON.stringify(removidos), citacao],
      );
    }

    for (const a of arquivos) {
      const pasta = join(base, 'materiais', String(n));
      await mkdir(pasta, { recursive: true });
      const seguro = a.nome.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
      const caminho = join(pasta, `${Date.now()}-${seguro}`);
      await writeFile(caminho, a.buf);

      let texto: string | null = null;
      let anonimo = false;
      let removidos: Record<string, number> = {};
      try {
        if (/\.pdf$/i.test(a.nome)) {
          const bruto = await textoDoPdf(a.buf);
          if (bruto.length < 40) {
            avisos.push(`${a.nome}: sem texto selecionável (parece digitalizado como imagem). Guardado, mas o sistema não consegue ler.`);
          } else if (consulta) {
            const r = anonimizar(bruto);
            texto = r.texto.slice(0, 500_000);
            removidos = r.removidos;
            anonimo = true;
            anonimizados++;
          } else {
            texto = bruto.slice(0, 500_000);
          }
        } else if (/\.(txt|md|csv)$/i.test(a.nome)) {
          const bruto = a.buf.toString('utf8');
          if (consulta) {
            const r = anonimizar(bruto);
            texto = r.texto.slice(0, 500_000);
            removidos = r.removidos;
            anonimo = true;
            anonimizados++;
          } else texto = bruto.slice(0, 500_000);
        } else {
          avisos.push(`${a.nome}: formato sem leitura automática. Guardado no servidor.`);
        }
      } catch {
        avisos.push(`${a.nome}: não consegui ler o texto. Guardado assim mesmo.`);
      }
      await guardar((campos.nome?.trim() && arquivos.length === 1 ? campos.nome.trim() : a.nome).slice(0, 200), texto, caminho, a.buf.length, anonimo, removidos);
    }

    if (campos.texto?.trim()) {
      let texto = campos.texto.slice(0, 500_000);
      let anonimo = false;
      let removidos: Record<string, number> = {};
      if (consulta) {
        const r = anonimizar(texto);
        texto = r.texto;
        removidos = r.removidos;
        anonimo = true;
        anonimizados++;
      }
      await guardar((campos.nome?.trim() || texto.slice(0, 60) + '…').slice(0, 200), texto, null, texto.length, anonimo, removidos);
    }

    const partes = [];
    if (anonimizados) partes.push(`${anonimizados} documento(s) anonimizado(s) antes de guardar. Isto reduz o risco, não elimina: vale conferir.`);
    if (avisos.length) partes.push(avisos.join(' '));
    const q1 = avisos.length ? 'erro' : 'ok';
    return res.redirect(
      `/setup/modulos/${n}?${q1}=${encodeURIComponent(partes.join(' ') || 'Documento adicionado.')}`,
    );
  });

  app.post<{ Params: { n: string; id: string } }>('/setup/modulos/:n/remover/:id', async (req: any, res) => {
    if (!exige(req, res)) return;
    await q('DELETE FROM materiais WHERE id = $1', [req.params.id]);
    return res.redirect(`/setup/modulos/${Number(req.params.n)}`);
  });

  // ------------------------------------------------------------- gerar o exemplo
  app.post<{ Params: { n: string } }>('/setup/modulos/:n/exemplo', async (req: any, res) => {
    if (!exige(req, res)) return;
    const n = Number(req.params.n);
    if (!valido(n)) return res.callNotFound();
    try {
      const r = await gerarExemplo(n);
      if (r.estado === 'vazio') {
        return res.redirect(`/setup/modulos/${n}?erro=${encodeURIComponent(r.erro ?? '')}#exemplo`);
      }
    } catch (e: any) {
      return res.redirect(
        `/setup/modulos/${n}?erro=${encodeURIComponent('Não consegui gerar: ' + String(e?.message ?? e).slice(0, 200))}#exemplo`,
      );
    }
    return res.redirect(`/setup/modulos/${n}#exemplo`);
  });

  app.get<{ Params: { n: string } }>('/setup/modulos/:n/exemplo.pdf', async (req: any, res) => {
    if (!exige(req, res)) return;
    const n = Number(req.params.n);
    if (!valido(n)) return res.callNotFound();
    const saida = await um<any>("SELECT conteudo, provedor, modelo FROM exemplo_saidas WHERE modulo = $1 AND estado = 'pronto'", [n]);
    if (!saida) return res.callNotFound();
    const respostas = await q<{ rotulo: string; valor: string }>(
      `SELECT p.rotulo, e.valor FROM exemplos e JOIN perguntas p ON p.modulo = e.modulo AND p.campo = e.campo
        WHERE e.modulo = $1 AND btrim(e.valor) <> '' ORDER BY p.ordem`,
      [n],
    );
    const perfil = (await lerConfig<any>('perfil')) ?? {};
    const buf = await pdfExemplo({
      modulo: n,
      titulo: MODULOS.find((m) => m.numero === n)!.titulo,
      mentora: perfil.nome || 'a mentora',
      respostas,
      saida: saida.conteudo,
      provedor: saida.provedor,
      modelo: saida.modelo,
    });
    return res
      .type('application/pdf')
      .header('content-disposition', `inline; filename="modulo-${n}-exemplo.pdf"`)
      .send(buf);
  });
}
