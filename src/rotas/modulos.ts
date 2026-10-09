import type { FastifyInstance } from 'fastify';
import { q, um, lerConfig } from '../db.ts';
import { esc } from '../visao/layout.ts';
import { anonimizar, textoDoPdf } from '../anonimizar.ts';
import { MODULOS, gerarExemplo, gerarSkillDoModulo } from '../geracao.ts';
import { conferirSenha } from '../auth.ts';
import { skillMd } from '../persona.ts';
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

function campo(p: Pergunta, valor: string, trava: boolean): string {
  const dis = trava ? ' disabled' : '';
  const id = `p_${p.campo}`;
  const nome = `r_${p.campo}`;
  let entrada: string;
  if (p.tipo === 'numero') {
    entrada = `<input${dis} id="${id}" name="${nome}" type="number" step="any" value="${esc(valor)}" placeholder="${esc(p.exemplo ?? '')}">`;
  } else if (p.tipo === 'texto_curto') {
    entrada = `<input${dis} id="${id}" name="${nome}" type="text" value="${esc(valor)}" placeholder="${esc(p.exemplo ?? '')}">`;
  } else if (p.tipo === 'escolha' && Array.isArray(p.opcoes)) {
    entrada = `<select${dis} id="${id}" name="${nome}"><option value=""></option>${p.opcoes
      .map((o) => `<option${o === valor ? ' selected' : ''}>${esc(o)}</option>`)
      .join('')}</select>`;
  } else {
    entrada = `<textarea${dis} id="${id}" name="${nome}" placeholder="${esc(p.exemplo ?? '')}">${esc(valor)}</textarea>`;
  }
  return `<div class="campo">
    <label for="${id}">${esc(p.rotulo)}${p.obrigatoria ? '' : ' <small>(opcional)</small>'}</label>
    ${p.ajuda ? `<div class="dica">${esc(p.ajuda)}</div>` : ''}
    ${entrada}
  </div>`;
}

const TEXTO_LARANJA =
  'Quanto mais material você me fornecer — livros, documentos — mais eu consigo me adaptar ao seu estilo de mentoria.';

async function estadoDoModulo(n: number) {
  const e = await um<{ aprovado: boolean; rodada: number }>(
    'SELECT aprovado, rodada FROM modulo_estado WHERE modulo = $1',
    [n],
  );
  return { aprovado: !!e?.aprovado, rodada: e?.rodada ?? 0 };
}

/** Lê um formulário multipart sem gravar nada em disco. */
async function lerPartes(req: any) {
  const campos: Record<string, string> = {};
  const arquivos: { nome: string; buf: Buffer }[] = [];
  for await (const parte of req.parts()) {
    if (parte.type === 'file') {
      const buf = await parte.toBuffer();
      if (buf.length > 0) arquivos.push({ nome: parte.filename, buf });
    } else campos[parte.fieldname] = String(parte.value ?? '');
  }
  return { campos, arquivos };
}

/** Texto legível de um arquivo enviado, ou um aviso do porquê não deu. */
async function textoDoArquivo(nome: string, buf: Buffer): Promise<{ texto: string | null; aviso?: string }> {
  try {
    if (/\.pdf$/i.test(nome)) {
      const bruto = await textoDoPdf(buf);
      if (bruto.length < 40)
        return { texto: null, aviso: `${nome}: sem texto selecionável (parece digitalizado como imagem). O programa não consegue ler.` };
      return { texto: bruto.slice(0, 500_000) };
    }
    if (/\.(txt|md|csv)$/i.test(nome)) return { texto: buf.toString('utf8').slice(0, 500_000) };
    return { texto: null, aviso: `${nome}: formato sem leitura automática.` };
  } catch {
    return { texto: null, aviso: `${nome}: não consegui ler o texto.` };
  }
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
  const json = (res: any, codigo: number, corpo: unknown) => res.code(codigo).type('application/json').send(corpo);

  // ------------------------------------------------------------- lista
  app.get('/setup/modulos', async (req: any, res) => {
    if (!exige(req, res)) return;
    const perg = await q<{ modulo: number; n: string }>('SELECT modulo, count(*)::text AS n FROM perguntas WHERE ativa GROUP BY 1');
    const resp = await q<{ modulo: number; n: string }>("SELECT modulo, count(*)::text AS n FROM exemplos WHERE btrim(valor) <> '' GROUP BY 1");
    const docs = await q<{ modulo: number; n: string }>('SELECT modulo, count(*)::text AS n FROM materiais WHERE modulo BETWEEN 1 AND 6 GROUP BY 1');
    const est = await q<{ modulo: number; aprovado: boolean; rodada: number }>('SELECT modulo, aprovado, rodada FROM modulo_estado');
    const mapa = (l: { modulo: number; n: string }[]) => new Map(l.map((x) => [Number(x.modulo), Number(x.n)]));
    const P = mapa(perg), R = mapa(resp), D = mapa(docs);
    const E = new Map(est.map((e) => [Number(e.modulo), e]));

    const linhas = MODULOS.map((m) => {
      const e = E.get(m.numero);
      const situacao = e?.aprovado
        ? 'APROVADO'
        : e?.rodada
          ? `PDF gerado ${e.rodada} ${e.rodada === 1 ? 'vez' : 'vezes'}, aguardando sua aprovação`
          : 'PDF ainda não gerado';
      return `<li>
        <span class="marca ${e?.aprovado ? 'feita' : ''}">${String(m.numero).padStart(2, '0')}</span>
        <span><span class="etapa-nome"><a href="/setup/modulos/${m.numero}">${esc(m.titulo)}</a></span><br>
          <small>${R.get(m.numero) ?? 0} de ${P.get(m.numero) ?? 0} perguntas · ${D.get(m.numero) ?? 0} documento(s) · ${situacao}</small></span>
      </li>`;
    }).join('');

    return res.type('text/html').send(
      molde(
        NUMERO.modulos,
        'Os seis módulos',
        `<p class="sub">Em cada módulo você responde as perguntas como se fosse uma mentorada, sobe os
          documentos que embasam o módulo e clica em <strong>Gerar PDF</strong>. O programa escreve a
          skill do módulo e, a partir dela, o PDF do que a IA produziria. Você lê, anota o que ajustar
          e gera de novo, quantas vezes precisar. Quando estiver como você quer, aprove.</p>
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
      const { aprovado, rodada } = await estadoDoModulo(n);

      const perguntas = await q<Pergunta>(
        `SELECT campo, rotulo, ajuda, exemplo, tipo, opcoes, obrigatoria
           FROM perguntas WHERE modulo = $1 AND ativa ORDER BY ordem`,
        [n],
      );
      const respostas = await q<{ campo: string; valor: string }>('SELECT campo, valor FROM exemplos WHERE modulo = $1', [n]);
      const valores = new Map(respostas.map((r) => [r.campo, r.valor]));
      const docs = await q<any>('SELECT id, nome, citacao, anonimizado FROM materiais WHERE modulo = $1 ORDER BY criado_em', [n]);
      const obs = await q<any>(
        "SELECT id, texto, nome_arquivo, to_char(criado_em,'DD/MM HH24:MI') AS quando FROM observacoes WHERE modulo = $1 ORDER BY criado_em",
        [n],
      );
      const saida = await um<any>(
        `SELECT estado, erro, provedor, modelo, to_char(gerado_em,'DD/MM HH24:MI') AS quando FROM exemplo_saidas WHERE modulo = $1`,
        [n],
      );
      const pasta = await lerConfig<{ nome?: string; caminho?: string }>('pasta_pc');
      const temPdf = saida?.estado === 'pronto' && rodada > 0;

      const listaDocs = docs.length
        ? `<table><thead><tr><th>Documento</th><th>Citação</th><th></th></tr></thead><tbody>
            ${docs
              .map(
                (d: any) => `<tr>
                <td>${esc(d.nome)}${d.anonimizado ? ' <span class="etiqueta">anonimizado</span>' : ''}</td>
                <td><small>${esc(d.citacao ?? '—')}</small></td>
                <td>${
                  aprovado
                    ? ''
                    : `<form method="post" action="/setup/modulos/${n}/remover/${esc(d.id)}" style="display:inline">
                  <button type="submit" class="calmo pequeno">Remover</button></form>`
                }</td></tr>`,
              )
              .join('')}
          </tbody></table>`
        : '<p class="sub">Nenhum documento ainda.</p>';

      const listaObs = obs.length
        ? `<ol class="obs">${obs
            .map((o: any) => `<li><small>${esc(o.quando)}${o.nome_arquivo ? ' · ' + esc(o.nome_arquivo) : ''}</small><br>${esc(String(o.texto).slice(0, 600))}${o.texto.length > 600 ? '…' : ''}</li>`)
            .join('')}</ol>`
        : '';

      const flash = req.query.erro
        ? `<div class="erro">${esc(String(req.query.erro).slice(0, 300))}</div>`
        : req.query.ok
          ? `<div class="ok">${esc(String(req.query.ok).slice(0, 200))}</div>`
          : '';

      const caixaPasta = pasta?.caminho
        ? `<div class="caminho"><span>Seus arquivos ficam em: <strong id="caminho-pasta">${esc(pasta.caminho)}</strong></span>
             <button type="button" class="calmo pequeno" id="copiar-caminho" title="Copiar o caminho para colar no Explorador de Arquivos">📁 Copiar caminho</button></div>`
        : `<div class="aviso">Você ainda não escolheu a pasta do seu computador. <a href="/setup/pasta">Escolha agora</a>: é lá que os arquivos ficam, o servidor não guarda nenhum.</div>`;

      const painelAprovado = `<div class="acoes" style="align-items:center">
          <span class="selo-aprovado">Módulo aprovado</span>
          ${temPdf ? `<a class="botao" href="/setup/modulos/${n}/exemplo.pdf" target="_blank">Abrir o PDF aprovado</a>` : ''}
        </div>
        <form method="post" action="/setup/modulos/${n}/editar" style="margin-top:22px">
          <div class="campo"><label for="senha-editar">Para editar, digite a senha da sua conta</label>
            <input id="senha-editar" name="senha" type="password" required autocomplete="current-password" style="max-width:320px"></div>
          <div class="acoes"><button type="submit" class="grande">Editar</button></div>
        </form>`;

      const blocoGerar = `
        <h3 style="margin-top:44px" id="exemplo">3 · Gerar o PDF</h3>
        <p class="sub">Ao clicar, o programa primeiro escreve a skill deste módulo (a partir das suas respostas,
          documentos e observações, sempre do zero) e depois gera o PDF usando essa skill.</p>
        <div class="acoes"><button type="button" class="grande" id="gerar">${temPdf ? 'Gerar PDF de novo' : 'Gerar PDF'}</button></div>
        <div class="estado-gerar" id="estado-gerar"></div>
        <div id="msg-pasta"></div>
        <div id="area-pdf" style="${temPdf ? '' : 'display:none'}">
          <h3 style="margin-top:28px">PDF — versão <span id="rodada">${rodada}</span></h3>
          <iframe id="quadro-pdf" src="${temPdf ? `/setup/modulos/${n}/exemplo.pdf?v=${rodada}` : 'about:blank'}" style="width:100%;height:640px;border:1px solid var(--linha);background:#fff"></iframe>
          <div class="acoes"><a class="botao calmo" id="abrir-pdf" href="/setup/modulos/${n}/exemplo.pdf" target="_blank">Abrir em outra aba</a></div>

          <h3 style="margin-top:34px">Observações</h3>
          <p class="sub">Diga o que ajustar: escreva aqui, ou envie um PDF ou arquivo de texto. Depois clique em
            “Gerar PDF de novo”: a skill é reescrita do zero com tudo o que você já enviou mais estas observações.</p>
          ${listaObs}
          <div class="campo"><label for="obs-texto">Escrever observação</label><textarea id="obs-texto"></textarea></div>
          <div class="campo"><label for="obs-arquivo">Ou enviar um arquivo (PDF, texto)</label><input id="obs-arquivo" type="file" accept=".pdf,.txt,.md"></div>
          <div class="acoes"><button type="button" class="calmo" id="enviar-obs">Guardar observação</button></div>
          <div id="msg-obs"></div>

          <form method="post" action="/setup/modulos/${n}/aprovar" style="margin-top:34px">
            <div class="acoes"><button type="submit" class="grande">Aprovar</button></div>
            <p class="sub"><small>Aprovado, o módulo fica bloqueado. Para mexer de novo, clique em Editar e confirme com a senha da sua conta.</small></p>
          </form>
        </div>`;

      const corpo = `${flash}
        ${caixaPasta}
        ${aprovado ? painelAprovado : ''}
        <h2>1 · Perguntas de entrada</h2>
        <p class="sub">${aprovado ? 'Módulo bloqueado.' : 'Responda como se fosse uma cliente sua: isto vira o exemplo de preenchimento.'}</p>
        <form method="post" action="/setup/modulos/${n}/respostas" id="form-respostas">
          ${perguntas.map((p) => campo(p, valores.get(p.campo) ?? '', aprovado)).join('')}
          ${aprovado ? '' : '<div class="acoes"><button type="submit">Salvar as respostas</button></div>'}
        </form>

        <h3 style="margin-top:44px">2 · Documentos</h3>
        <p class="sub">Livros, referências ou consultas já feitas. Pode subir vários. O arquivo original é copiado
          para a sua pasta; no servidor fica só o texto.</p>
        ${listaDocs}
        ${
          aprovado
            ? ''
            : `<form id="form-doc">
            <div class="campo"><label>Que tipo de documento é</label>
              <div class="escolhas">
                <label><input type="radio" name="tipo_doc" value="referencia" checked>Livro ou referência</label>
                <label><input type="radio" name="tipo_doc" value="consulta">Consulta que já fiz (anonimizar)</label>
              </div></div>
            <div class="campo"><label for="arquivo">Arquivos</label>
              <div class="dica">PDF, texto ou markdown. Até 20 MB cada.</div>
              <input id="arquivo" name="arquivo" type="file" multiple></div>
            <div class="campo"><label for="texto">Ou cole um texto</label><textarea id="texto" name="texto"></textarea></div>
            <div class="campo"><label for="nome">Nome do documento</label>
              <input id="nome" name="nome" type="text" placeholder="Por exemplo: StoryBrand, capítulo sobre o guia"></div>
            <div class="campo"><div class="escolhas"><label><input type="checkbox" id="quer-citacao" name="quer_citacao" value="1">Adicionar citação do documento</label></div>
              <div id="bloco-citacao" style="display:none;margin-top:12px">
                <input id="citacao" name="citacao" type="text" placeholder="Páginas 12 a 18, capítulo 3">
                <div class="exemplo">Indique de onde o programa deve tirar: páginas, capítulo, trecho.</div>
              </div></div>
            <div class="barra" id="barra"><i></i></div>
            <div class="estado-gerar" id="estado-doc"></div>
            <div class="acoes"><button type="submit">Adicionar documento</button></div>
          </form>`
        }
        ${aprovado ? '' : blocoGerar}
        ${aprovado ? '' : `<div class="laranja" id="laranja">${esc(TEXTO_LARANJA)}</div>`}
        <div class="acoes"><a class="botao calmo" href="/setup/modulos">Voltar aos módulos</a></div>
        <script>
        (function(){
          var N=${n};
          var PASTA=${JSON.stringify(pasta?.caminho ?? '')};
          function seguro(t){return String(t).replace(/[^\\w.\\- ]+/g,'_').slice(0,120)}
          function msg(id,cls,t){var e=document.getElementById(id);if(!e)return;e.innerHTML='<div class="'+cls+'"></div>';e.firstChild.textContent=t}
          function juntar(rel){if(!PASTA)return rel;var sep=PASTA.indexOf('\\\\')>=0?'\\\\':'/';return PASTA.replace(/[\\\\/]$/,'')+sep+rel.split('/').join(sep)}
          var cp=document.getElementById('copiar-caminho');
          if(cp)cp.addEventListener('click',function(){
            var t=document.getElementById('caminho-pasta').textContent;
            (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){cp.textContent='Copiado ✓'},function(){window.prompt('Copie o caminho:',t)});
          });
          function enviar(url,fd,barra){
            return new Promise(function(ok,no){
              var x=new XMLHttpRequest();x.open('POST',url);
              x.upload.onprogress=function(e){if(barra&&e.lengthComputable){barra.style.display='block';barra.firstChild.style.width=Math.round(e.loaded/e.total*100)+'%'}};
              x.onload=function(){try{var j=JSON.parse(x.responseText);j.status=x.status;ok(j)}catch(e){no(new Error('Resposta inesperada do servidor.'))}};
              x.onerror=function(){no(new Error('Falha de rede.'))};
              x.send(fd);
            });
          }
          async function copiarOriginais(pasta,arquivos){
            if(!arquivos.length)return '';
            if(!hubPasta.suportado()||!(await hubPasta.atual()))return ' (Escolha a pasta para guardar os originais no seu computador.)';
            var h=await hubPasta.garantir();
            if(!h)return ' (O navegador não liberou a pasta, os originais não foram copiados.)';
            var l=[];for(var i=0;i<arquivos.length;i++)l.push({caminho:pasta+'/'+seguro(arquivos[i].name),blob:arquivos[i]});
            await hubPasta.escrever(l);
            return ' Originais copiados para '+juntar(pasta)+'.';
          }

          var qc=document.getElementById('quer-citacao'),bc=document.getElementById('bloco-citacao');
          if(qc)qc.addEventListener('change',function(){bc.style.display=qc.checked?'block':'none'});

          var fd0=document.getElementById('form-doc');
          if(fd0)fd0.addEventListener('submit',async function(ev){
            ev.preventDefault();
            var f=document.getElementById('arquivo').files;
            var b=document.getElementById('barra');b.style.display='none';b.firstChild.style.width='0';
            msg('estado-doc','sub','Enviando…');
            try{
              var j=await enviar('/setup/modulos/'+N+'/material',new FormData(fd0),b);
              if(!j.ok){msg('estado-doc','erro',j.erro||'Não consegui adicionar.');return}
              var extra='';try{extra=await copiarOriginais('documentos/modulo-'+N,Array.prototype.slice.call(f))}catch(e){extra=' ('+(e.message||e)+')'}
              msg('estado-doc',j.avisos&&j.avisos.length?'aviso':'ok',(j.mensagem||'Documento adicionado.')+extra);
              setTimeout(function(){location.href='/setup/modulos/'+N},1800);
            }catch(e){msg('estado-doc','erro',e.message||String(e))}
          });

          var eo=document.getElementById('enviar-obs');
          async function guardarObs(){
            var t=document.getElementById('obs-texto').value.trim();
            var a=document.getElementById('obs-arquivo').files;
            if(!t&&!a.length)return true;
            var fd=new FormData();fd.append('texto',t);if(a.length)fd.append('arquivo',a[0]);
            var j=await enviar('/setup/modulos/'+N+'/observacao',fd,null);
            if(!j.ok)throw new Error(j.erro||'Não consegui guardar a observação.');
            try{await copiarOriginais('observacoes/modulo-'+N,Array.prototype.slice.call(a))}catch(e){}
            document.getElementById('obs-texto').value='';document.getElementById('obs-arquivo').value='';
            return true;
          }
          if(eo)eo.addEventListener('click',async function(){
            try{await guardarObs();msg('msg-obs','ok','Observação guardada. Clique em “Gerar PDF de novo” para aplicar.');setTimeout(function(){location.reload()},1200)}
            catch(e){msg('msg-obs','erro',e.message||String(e))}
          });

          var g=document.getElementById('gerar');
          if(g)g.addEventListener('click',async function(){
            g.disabled=true;var est=document.getElementById('estado-gerar');
            try{
              est.textContent='Salvando as respostas…';
              var fr=document.getElementById('form-respostas');
              await fetch(fr.action,{method:'POST',body:new URLSearchParams(new FormData(fr)),redirect:'manual'});
              await guardarObs();
              est.textContent='Escrevendo a skill do módulo e gerando o PDF… isso leva alguns segundos.';
              var r=await fetch('/setup/modulos/'+N+'/gerar',{method:'POST'});
              var j=await r.json();
              if(!j.ok){est.textContent='';msg('msg-pasta','erro',j.erro||'Não consegui gerar.');g.disabled=false;return}
              est.textContent='Pronto. Salvando na sua pasta…';
              document.getElementById('area-pdf').style.display='block';
              document.getElementById('rodada').textContent=j.rodada;
              document.getElementById('quadro-pdf').src='/setup/modulos/'+N+'/exemplo.pdf?v='+j.rodada;
              g.textContent='Gerar PDF de novo';
              var pdf=await (await fetch('/setup/modulos/'+N+'/exemplo.pdf?v='+j.rodada)).blob();
              try{
                await hubPasta.escrever([
                  {caminho:'pdfs/modulo-'+N+'/versao-'+j.rodada+'.pdf',blob:pdf},
                  {caminho:'skills/modulo-'+N+'/'+j.nome+'/SKILL.md',conteudo:j.md}
                ]);
                msg('msg-pasta','ok','Salvo em '+juntar('pdfs/modulo-'+N+'/versao-'+j.rodada+'.pdf')+' e '+juntar('skills/modulo-'+N+'/'+j.nome+'/SKILL.md'));
              }catch(e){msg('msg-pasta','aviso',(e.message||e)+' Escolha a pasta em “Pasta”, no topo, para os arquivos serem salvos no seu computador.')}
              est.textContent='';
            }catch(e){est.textContent='';msg('msg-pasta','erro',e.message||String(e))}
            g.disabled=false;
          });
        })();
        </script>`;

      return res.type('text/html').send(molde(NUMERO.modulos, `${n}. ${mod.titulo}`, corpo));
    },
  );

  // ------------------------------------------------------------- respostas de exemplo
  app.post<{ Params: { n: string }; Body: Record<string, string> }>('/setup/modulos/:n/respostas', async (req: any, res) => {
    if (!exige(req, res)) return;
    const n = Number(req.params.n);
    if (!valido(n)) return res.callNotFound();
    if ((await estadoDoModulo(n)).aprovado) return res.redirect(`/setup/modulos/${n}`);
    const perguntas = await q<{ campo: string }>('SELECT campo FROM perguntas WHERE modulo = $1 AND ativa', [n]);
    for (const p of perguntas) {
      const v = String(req.body?.[`r_${p.campo}`] ?? '').trim().slice(0, 8000);
      await q(
        `INSERT INTO exemplos (modulo, campo, valor) VALUES ($1,$2,$3)
         ON CONFLICT (modulo, campo) DO UPDATE SET valor = EXCLUDED.valor, salvo_em = now()`,
        [n, p.campo, v],
      );
    }
    return res.redirect(`/setup/modulos/${n}?ok=${encodeURIComponent('Respostas salvas.')}`);
  });

  // ------------------------------------------------------------- documentos (só o texto vai ao servidor)
  app.post<{ Params: { n: string } }>('/setup/modulos/:n/material', async (req: any, res) => {
    if (!req.mentora) return json(res, 401, { ok: false, erro: 'Entre de novo.' });
    const n = Number(req.params.n);
    if (!valido(n)) return json(res, 404, { ok: false, erro: 'Módulo inválido.' });
    if ((await estadoDoModulo(n)).aprovado) return json(res, 423, { ok: false, erro: 'Módulo aprovado. Clique em Editar.' });

    const { campos, arquivos } = await lerPartes(req);
    const consulta = campos.tipo_doc === 'consulta';
    const citacao = campos.quer_citacao && campos.citacao?.trim() ? campos.citacao.trim().slice(0, 300) : null;
    const avisos: string[] = [];
    let anonimizados = 0;
    let adicionados = 0;

    async function guardar(nome: string, texto: string, bytes: number, removidos: Record<string, number>, anonimo: boolean) {
      await q(
        `INSERT INTO materiais (modulo, nome, tipo, caminho, conteudo, bytes, anonimizado, removidos, citacao)
         VALUES ($1,$2,'texto',NULL,$3,$4,$5,$6,$7)`,
        [n, nome, texto, bytes, anonimo, JSON.stringify(removidos), citacao],
      );
      adicionados++;
    }
    function preparar(bruto: string) {
      if (!consulta) return { texto: bruto, removidos: {} as Record<string, number>, anonimo: false };
      const r = anonimizar(bruto);
      anonimizados++;
      return { texto: r.texto, removidos: r.removidos, anonimo: true };
    }

    for (const a of arquivos) {
      const { texto, aviso } = await textoDoArquivo(a.nome, a.buf);
      if (aviso) avisos.push(aviso);
      if (!texto) continue;
      const p = preparar(texto);
      const nome = (campos.nome?.trim() && arquivos.length === 1 ? campos.nome.trim() : a.nome).slice(0, 200);
      await guardar(nome, p.texto, a.buf.length, p.removidos, p.anonimo);
    }
    if (campos.texto?.trim()) {
      const p = preparar(campos.texto.slice(0, 500_000));
      await guardar((campos.nome?.trim() || p.texto.slice(0, 60) + '…').slice(0, 200), p.texto, p.texto.length, p.removidos, p.anonimo);
    }
    if (!adicionados && !avisos.length) return json(res, 400, { ok: false, erro: 'Escolha um arquivo ou cole um texto.' });
    if (!adicionados) return json(res, 422, { ok: false, erro: avisos.join(' ') });

    const partes = [`${adicionados} documento(s) adicionado(s).`];
    if (anonimizados) partes.push(`${anonimizados} anonimizado(s) antes de guardar: reduz o risco, não elimina, vale conferir.`);
    if (avisos.length) partes.push(avisos.join(' '));
    return json(res, 200, { ok: true, avisos, mensagem: partes.join(' ') });
  });

  app.post<{ Params: { n: string; id: string } }>('/setup/modulos/:n/remover/:id', async (req: any, res) => {
    if (!exige(req, res)) return;
    const n = Number(req.params.n);
    if (!valido(n)) return res.callNotFound();
    if (!(await estadoDoModulo(n)).aprovado) await q('DELETE FROM materiais WHERE id = $1 AND modulo = $2', [req.params.id, n]);
    return res.redirect(`/setup/modulos/${n}`);
  });

  // ------------------------------------------------------------- observações sobre o PDF
  app.post<{ Params: { n: string } }>('/setup/modulos/:n/observacao', async (req: any, res) => {
    if (!req.mentora) return json(res, 401, { ok: false, erro: 'Entre de novo.' });
    const n = Number(req.params.n);
    if (!valido(n)) return json(res, 404, { ok: false, erro: 'Módulo inválido.' });
    if ((await estadoDoModulo(n)).aprovado) return json(res, 423, { ok: false, erro: 'Módulo aprovado. Clique em Editar.' });
    const { campos, arquivos } = await lerPartes(req);
    let n_ok = 0;
    if (campos.texto?.trim()) {
      await q("INSERT INTO observacoes (modulo, texto, origem) VALUES ($1,$2,'texto')", [n, campos.texto.trim().slice(0, 20_000)]);
      n_ok++;
    }
    for (const a of arquivos) {
      const { texto, aviso } = await textoDoArquivo(a.nome, a.buf);
      if (!texto) return json(res, 422, { ok: false, erro: aviso ?? 'Não consegui ler o arquivo.' });
      await q("INSERT INTO observacoes (modulo, texto, origem, nome_arquivo) VALUES ($1,$2,'arquivo',$3)", [n, texto.slice(0, 20_000), a.nome.slice(0, 200)]);
      n_ok++;
    }
    if (!n_ok) return json(res, 400, { ok: false, erro: 'Escreva a observação ou envie um arquivo.' });
    return json(res, 200, { ok: true });
  });

  // ------------------------------------------------------------- gerar: skill, depois PDF
  app.post<{ Params: { n: string } }>('/setup/modulos/:n/gerar', async (req: any, res) => {
    if (!req.mentora) return json(res, 401, { ok: false, erro: 'Entre de novo.' });
    const n = Number(req.params.n);
    if (!valido(n)) return json(res, 404, { ok: false, erro: 'Módulo inválido.' });
    if ((await estadoDoModulo(n)).aprovado) return json(res, 423, { ok: false, erro: 'Módulo aprovado. Clique em Editar.' });

    const s = await gerarSkillDoModulo(n);
    if (!s.ok) return json(res, 200, { ok: false, erro: s.erro });
    const e = await gerarExemplo(n);
    if (!e.ok) return json(res, 200, { ok: false, erro: e.erro });
    const sk = await um<any>('SELECT nome, descricao, quando_usar, instrucoes FROM skills WHERE id = $1', [s.skillId]);
    return json(res, 200, { ok: true, rodada: e.rodada, nome: sk.nome, md: skillMd(sk) });
  });

  // ------------------------------------------------------------- aprovar e editar
  app.post<{ Params: { n: string } }>('/setup/modulos/:n/aprovar', async (req: any, res) => {
    if (!exige(req, res)) return;
    const n = Number(req.params.n);
    if (!valido(n)) return res.callNotFound();
    const ok = await um("SELECT 1 FROM exemplo_saidas WHERE modulo = $1 AND estado = 'pronto'", [n]);
    if (!ok) return res.redirect(`/setup/modulos/${n}?erro=${encodeURIComponent('Gere o PDF antes de aprovar.')}`);
    await q(
      `INSERT INTO modulo_estado (modulo, aprovado, aprovado_em) VALUES ($1,true,now())
       ON CONFLICT (modulo) DO UPDATE SET aprovado = true, aprovado_em = now()`,
      [n],
    );
    return res.redirect(`/setup/modulos/${n}?ok=${encodeURIComponent('Módulo aprovado e bloqueado.')}`);
  });

  const tentativas = new Map<string, number[]>();
  app.post<{ Params: { n: string }; Body: { senha?: string } }>('/setup/modulos/:n/editar', async (req: any, res) => {
    if (!exige(req, res)) return;
    const n = Number(req.params.n);
    if (!valido(n)) return res.callNotFound();
    const agora = Date.now();
    const recentes = (tentativas.get(req.mentora.id) ?? []).filter((t) => agora - t < 10 * 60_000);
    if (recentes.length >= 5)
      return res.redirect(`/setup/modulos/${n}?erro=${encodeURIComponent('Muitas tentativas. Espere alguns minutos.')}`);
    const m = await um<{ senha_hash: Buffer; senha_salt: Buffer }>('SELECT senha_hash, senha_salt FROM mentora WHERE id = $1', [req.mentora.id]);
    const certa = m && (await conferirSenha(String(req.body?.senha ?? ''), m.senha_hash, m.senha_salt));
    if (!certa) {
      recentes.push(agora);
      tentativas.set(req.mentora.id, recentes);
      return res.redirect(`/setup/modulos/${n}?erro=${encodeURIComponent('Senha incorreta.')}`);
    }
    tentativas.delete(req.mentora.id);
    await q('UPDATE modulo_estado SET aprovado = false WHERE modulo = $1', [n]);
    return res.redirect(`/setup/modulos/${n}?ok=${encodeURIComponent('Módulo liberado para edição.')}`);
  });

  // ------------------------------------------------------------- o PDF (montado na hora, nunca guardado)
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
    const obs = await q<{ texto: string; nome_arquivo: string | null }>('SELECT texto, nome_arquivo FROM observacoes WHERE modulo = $1 ORDER BY criado_em', [n]);
    const { rodada } = await estadoDoModulo(n);
    const perfil = (await lerConfig<any>('perfil')) ?? {};
    const buf = await pdfExemplo({
      modulo: n,
      titulo: MODULOS.find((m) => m.numero === n)!.titulo,
      mentora: perfil.nome || 'a mentora',
      respostas,
      saida: saida.conteudo,
      provedor: saida.provedor,
      modelo: saida.modelo,
      rodada,
      observacoes: obs.map((o) => (o.nome_arquivo ? `[${o.nome_arquivo}] ` : '') + o.texto),
      rodape: TEXTO_LARANJA,
    });
    return res
      .type('application/pdf')
      .header('content-disposition', `inline; filename="modulo-${n}-versao-${rodada}.pdf"`)
      .send(buf);
  });
}
