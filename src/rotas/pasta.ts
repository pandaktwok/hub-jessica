import type { FastifyInstance } from 'fastify';

import { molde, concluir, NUMERO } from './setup.ts';
import { gravarConfig } from '../db.ts';

// A pasta é do computador dela, não do servidor. O navegador (Chrome, Edge) deixa a
// página pedir uma pasta e escrever dentro dela; o servidor nunca vê o caminho.
// Skills e PDFs de exemplo são gravados lá quando ela clica em "Salvar na pasta".
export default async function rotasPasta(app: FastifyInstance) {
  app.get('/setup/pasta', async (_req, res) => {
    return res.type('text/html').send(
      molde(
        NUMERO.pasta,
        'A pasta do seu computador',
        `<p class="sub">Escolha uma pasta no seu computador. Tudo o que o programa gerar para você
          (as skills em arquivos .md e os PDFs de exemplo de cada módulo) é salvo lá dentro, e
          depois você me manda a pasta inteira.</p>
        <div id="estado"></div>
        <div class="acoes">
          <button type="button" id="escolher">Selecionar a pasta</button>
          <form method="post" action="/setup/pasta" style="display:inline" id="feito">
            <input type="hidden" name="nome" id="nome-pasta">
            <div id="bloco-caminho" style="display:none">
              <div class="campo"><label for="caminho">Caminho completo da pasta</label>
                <div class="dica">O navegador só me diz o nome da pasta. Cole aqui o caminho inteiro (no Explorador de Arquivos, clique na barra de endereço e copie), para eu mostrar onde cada arquivo foi salvo.</div>
                <input id="caminho" name="caminho" type="text" placeholder="C:\Users\Jessica\Documents\Hub" required></div>
              <button type="submit" id="continuar">Salvar e continuar</button>
            </div>
          </form>
        </div>
        <form method="post" action="/setup/pasta/pular">
          <p class="sub" style="margin-top:22px"><small>Se o seu navegador não deixar escolher
            pasta (Safari e Firefox não deixam), pule: os arquivos ficam disponíveis para baixar
            um a um.</small></p>
          <div class="acoes" style="margin-top:8px"><button type="submit" class="calmo pequeno">Pular, vou baixar os arquivos</button></div>
        </form>
        <script>
          (function(){
            var estado=document.getElementById('estado');
            var btn=document.getElementById('escolher');
                        var nome=document.getElementById('nome-pasta');
            function mostrar(h){
              estado.innerHTML='<div class="ok">Pasta escolhida: <strong></strong></div>';
              estado.querySelector('strong').textContent=h.name;
              nome.value=h.name;document.getElementById('bloco-caminho').style.display='block';
            }
            if(!hubPasta.suportado()){
              estado.innerHTML='<div class="aviso">Este navegador não deixa escolher uma pasta. Use o Chrome ou o Edge, ou pule esta etapa.</div>';
              btn.style.display='none';return;
            }
            hubPasta.atual().then(function(h){if(h)mostrar(h)});
            btn.addEventListener('click',function(){
              hubPasta.escolher().then(function(h){
                return hubPasta.escrever([{caminho:'LEIA-ME.txt',conteudo:'Pasta do Hub de Diagnostico. Skills e PDFs gerados ficam aqui.'}]).then(function(){mostrar(h)});
              }).catch(function(e){
                if(e&&e.name==='AbortError')return;
                estado.innerHTML='<div class="erro"></div>';estado.firstChild.textContent='Não consegui usar a pasta: '+(e.message||e);
              });
            });
          })();
        </script>`,
      ),
    );
  });

  app.post<{ Body: { nome?: string; caminho?: string } }>('/setup/pasta', async (req, res) => {
    const nome = String(req.body?.nome ?? '').slice(0, 200);
    const caminho = String(req.body?.caminho ?? '').trim().slice(0, 400);
    await gravarConfig('pasta_pc', { nome, caminho });
    await concluir('pasta', { nome, caminho });
    return res.redirect('/setup');
  });

  app.post('/setup/pasta/pular', async (_req, res) => {
    await concluir('pasta', { pulada: true });
    return res.redirect('/setup');
  });
}


