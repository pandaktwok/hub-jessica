import type { FastifyInstance } from 'fastify';
import { lerConfig, gravarConfig } from '../db.ts';
import { esc } from '../visao/layout.ts';
import { molde, concluir, NUMERO } from './setup.ts';

// Tabelas de preço usadas na calculadora. Conferidas em 2026-10-09.
//   Hostinger: página oficial de VPS (preço promocional e de renovação, ciclo de 2 anos).
//   HostGator: só o preço inicial é publicado; a renovação não aparece, então o cálculo
//              usa o inicial e a tela avisa.
//   IA: custo de um diagnóstico completo (seis módulos mais o Mapa), em dólar, medido
//       com ~78 mil tokens de entrada e ~16 mil de saída (ver README).
// Domínio e e-mail são estimativas editáveis: não foram conferidos num registrador.
const DADOS = {
  hospedagem: {
    hostinger: {
      nome: 'Hostinger',
      planos: [
        { id: 'kvm1', nome: 'KVM 1 · 1 vCPU · 4 GB · 50 GB NVMe', promo: 29.99, renov: 59.99 },
        { id: 'kvm2', nome: 'KVM 2 · 2 vCPU · 8 GB · 100 GB NVMe', promo: 43.99, renov: 77.99 },
        { id: 'kvm4', nome: 'KVM 4 · 4 vCPU · 16 GB · 200 GB NVMe', promo: 59.99, renov: 149.99 },
      ],
    },
    hostgator: {
      nome: 'HostGator',
      planos: [
        { id: 'nvme2', nome: 'VPS NVMe 2 · 1 vCPU · 2 GB · 50 GB NVMe', promo: 21.69, renov: null },
        { id: 'nvme4', nome: 'VPS NVMe 4 · 2 vCPU · 4 GB · 100 GB NVMe', promo: 30.39, renov: null },
        { id: 'nvme8', nome: 'VPS NVMe 8 · 4 vCPU · 8 GB · 200 GB NVMe', promo: 55.99, renov: null },
        { id: 'nvme12', nome: 'VPS NVMe 12 · 4 vCPU · 12 GB · 300 GB NVMe', promo: 77.49, renov: null },
      ],
    },
  },
  ia: {
    claude: { nome: 'Claude', modelos: [
      { id: 'haiku', nome: 'Haiku 5.5', usd: 0.02 },
      { id: 'sonnet', nome: 'Sonnet 5.5', usd: 0.32 },
      { id: 'opus', nome: 'Opus 5.5', usd: 0.63 },
    ] },
    gemini: { nome: 'Gemini', modelos: [
      { id: 'flash-lite', nome: '3.5 Flash-Lite', usd: 0.06 },
      { id: 'flash', nome: '3.8 Flash', usd: 0.12 },
    ] },
    gpt: { nome: 'GPT', modelos: [
      { id: 'luna', nome: '5.6 Luna', usd: 0.04 },
      { id: 'terra', nome: '5.6 Terra', usd: 0.35 },
    ] },
  },
};

const PADRAO = {
  hospedagem: 'hostinger',
  plano: 'kvm2',
  modo: 'renov',
  dominio_ano: 40,
  email_mes: 0,
  ia: 'gemini',
  modelo: 'flash',
  dolar: 5.4,
  p1: { nome: 'Pacote 1 · Mensal', preco: 500, clientes: 20, diag: 1 },
  p2: { nome: 'Pacote 2 · Anual', preco: 5000, clientes: 20, diag: 1 },
};

const SCRIPT = String.raw`
(function(){
  var D=__DADOS__;
  var E=__ESTADO__;
  var $=function(id){return document.getElementById(id)};
  var brl=function(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};
  var num=function(id){var v=parseFloat(String($(id).value).replace(',','.'));return isFinite(v)?v:0};

  function preencher(sel,lista,atual){
    sel.innerHTML='';
    lista.forEach(function(o){var op=document.createElement('option');op.value=o.id;op.textContent=o.nome;if(o.id===atual)op.selected=true;sel.appendChild(op)});
  }
  function planosDe(h){return D.hospedagem[h].planos}
  function modelosDe(i){return D.ia[i].modelos}

  var hosp=$('hospedagem'),plano=$('plano'),ia=$('ia'),modelo=$('modelo');
  preencher(hosp,Object.keys(D.hospedagem).map(function(k){return {id:k,nome:D.hospedagem[k].nome}}),E.hospedagem);
  preencher(plano,planosDe(E.hospedagem),E.plano);
  preencher(ia,Object.keys(D.ia).map(function(k){return {id:k,nome:D.ia[k].nome}}),E.ia);
  preencher(modelo,modelosDe(E.ia).map(function(m){return {id:m.id,nome:m.nome+' · US$ '+m.usd.toFixed(2)+' por diagnóstico'}}),E.modelo);
  document.querySelector('input[name=modo][value='+E.modo+']').checked=true;
  ['dominio_ano','email_mes','dolar'].forEach(function(k){$(k).value=E[k]});
  ['p1','p2'].forEach(function(p){['nome','preco','clientes','diag'].forEach(function(k){$(p+'_'+k).value=E[p][k]})});

  hosp.addEventListener('change',function(){preencher(plano,planosDe(hosp.value),null);calcular()});
  ia.addEventListener('change',function(){preencher(modelo,modelosDe(ia.value).map(function(m){return {id:m.id,nome:m.nome+' · US$ '+m.usd.toFixed(2)+' por diagnóstico'}}),null);calcular()});

  function servidor(){
    var p=planosDe(hosp.value).filter(function(x){return x.id===plano.value})[0]||planosDe(hosp.value)[0];
    var modo=document.querySelector('input[name=modo]:checked').value;
    var semRenov=p.renov===null;
    var valor=(modo==='renov'&&!semRenov)?p.renov:p.promo;
    return {valor:valor,semRenov:semRenov&&modo==='renov',plano:p};
  }

  function calcular(){
    var s=servidor();
    var fixo=s.valor+num('dominio_ano')/12+num('email_mes');
    var m=modelosDe(ia.value).filter(function(x){return x.id===modelo.value})[0]||modelosDe(ia.value)[0];
    var usdPorDiag=m.usd, dolar=num('dolar');
    $('nota-servidor').textContent=s.semRenov
      ?'A HostGator não publica o preço de renovação. O cálculo usa o preço inicial, que tende a subir. Confira no checkout.'
      :'';
    $('nota-servidor').style.display=s.semRenov?'block':'none';
    $('fixo-detalhe').textContent='Servidor '+brl(s.valor)+' + domínio '+brl(num('dominio_ano')/12)+' + e-mail '+brl(num('email_mes'))+', por mês.';

    var avisoNeg=false;
    [['p1',1],['p2',12]].forEach(function(par){
      var p=par[0],meses=par[1];
      var preco=num(p+'_preco'),clientes=num(p+'_clientes'),diag=num(p+'_diag');
      var receita=preco*clientes/meses;
      var ia_mes=clientes*diag*usdPorDiag*dolar/meses;
      var margem=receita-fixo-ia_mes;
      $(p+'_receita').textContent=brl(receita);
      $(p+'_fixo').textContent=brl(fixo);
      $(p+'_ia').textContent=brl(ia_mes);
      var el=$(p+'_margem');el.textContent=brl(margem);el.className=margem<0?'neg':'';
      $(p+'_linha').textContent=(meses===12?'Receita por mês: '+brl(preco)+' por ano ÷ 12 × '+clientes+' clientes = '+brl(receita)
        :'Receita por mês: '+brl(preco)+' × '+clientes+' clientes = '+brl(receita))+'. Custo por cliente: '+(clientes>0?brl((fixo+ia_mes)/clientes):'—')+' por mês.';
    });
    $('estado').value=JSON.stringify(coletar());
  }

  function coletar(){
    var o={hospedagem:hosp.value,plano:plano.value,modo:document.querySelector('input[name=modo]:checked').value,
      dominio_ano:num('dominio_ano'),email_mes:num('email_mes'),ia:ia.value,modelo:modelo.value,dolar:num('dolar')};
    ['p1','p2'].forEach(function(p){o[p]={nome:$(p+'_nome').value,preco:num(p+'_preco'),clientes:num(p+'_clientes'),diag:num(p+'_diag')}});
    return o;
  }

  document.querySelectorAll('input,select').forEach(function(el){el.addEventListener('input',calcular);el.addEventListener('change',calcular)});
  calcular();
})();
`;

function cartao(p: 'p1' | 'p2', rotuloPeriodo: string, precoRotulo: string): string {
  return `<div class="cartao">
    <h2>${esc(rotuloPeriodo)}</h2>
    <div class="campo"><label for="${p}_nome">Nome do pacote</label>
      <input id="${p}_nome" type="text"></div>
    <div class="campo"><label for="${p}_preco">${esc(precoRotulo)}</label>
      <input id="${p}_preco" type="number" step="0.01" min="0"></div>
    <div class="grade">
      <div class="campo"><label for="${p}_clientes">Média de clientes atendidas</label>
        <input id="${p}_clientes" type="number" min="0"></div>
      <div class="campo"><label for="${p}_diag">Diagnósticos por cliente</label>
        <input id="${p}_diag" type="number" min="0" step="1"></div>
    </div>
    <div class="faixa">
      <div><small>Custo fixo</small><strong id="${p}_fixo">—</strong></div>
      <div><small>Despesa de IA</small><strong id="${p}_ia">—</strong></div>
      <div><small>Margem</small><strong id="${p}_margem">—</strong></div>
    </div>
    <p class="sub"><small>Receita por mês: <strong id="${p}_receita">—</strong></small></p>
    <p class="sub"><small id="${p}_linha"></small></p>
  </div>`;
}

export default async function rotasPreco(app: FastifyInstance) {
  app.get('/setup/precificacao', async (req: any, res) => {
    if (!req.mentora) return res.redirect('/entrar');
    const salvo = (await lerConfig<any>('precificacao_v2')) ?? {};
    const estado = {
      ...PADRAO,
      ...salvo,
      p1: { ...PADRAO.p1, ...(salvo.p1 ?? {}) },
      p2: { ...PADRAO.p2, ...(salvo.p2 ?? {}) },
    };
    const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
    const script = SCRIPT.replace('__DADOS__', () => json(DADOS)).replace('__ESTADO__', () => json(estado));

    return res.type('text/html').send(
      molde(
        NUMERO.precificacao,
        'O preço da sua mentoria',
        `<p class="sub">Dois pacotes lado a lado. Mude os números e veja na hora o que sobra depois do que o
          programa custa para ficar no ar. Cada pacote é calculado como se fosse o único que você vende.</p>
        <div class="duas" style="margin-top:22px">
          ${cartao('p1', 'Pacote 1 · cobrança mensal', 'Quanto você cobra por mês, por cliente (R$)')}
          ${cartao('p2', 'Pacote 2 · cobrança anual', 'Quanto você cobra por ano, por cliente (R$)')}
        </div>

        <div class="cartao" style="margin-top:22px">
          <h2>Hospedagem · um servidor só</h2>
          <div class="grade">
            <div class="campo"><label for="hospedagem">Empresa</label><select id="hospedagem"></select></div>
            <div class="campo"><label for="plano">Plano</label><select id="plano"></select></div>
          </div>
          <div class="campo"><label>Qual preço usar</label>
            <div class="escolhas">
              <label><input type="radio" name="modo" value="renov">Renovação</label>
              <label><input type="radio" name="modo" value="promo">Promocional (primeiro período)</label>
            </div></div>
          <div class="grade">
            <div class="campo"><label for="dominio_ano">Domínio, por ano (R$)</label>
              <input id="dominio_ano" type="number" step="0.01" min="0">
              <div class="exemplo">Estimativa: confira no registrador.</div></div>
            <div class="campo"><label for="email_mes">E-mail profissional, por mês (R$)</label>
              <input id="email_mes" type="number" step="0.01" min="0">
              <div class="exemplo">Zero se usar o que já tem.</div></div>
          </div>
          <p class="sub"><small id="fixo-detalhe"></small></p>
          <div id="nota-servidor" class="aviso" style="display:none"></div>
        </div>

        <div class="cartao">
          <h2>Inteligência artificial</h2>
          <div class="grade">
            <div class="campo"><label for="ia">Qual</label><select id="ia"></select></div>
            <div class="campo"><label for="modelo">Modelo</label><select id="modelo"></select></div>
          </div>
          <div class="campo" style="max-width:240px"><label for="dolar">Dólar (R$)</label>
            <input id="dolar" type="number" step="0.01" min="0"></div>
          <p class="sub"><small>Custo de um diagnóstico completo (seis módulos e o Mapa), calculado pelos preços
            oficiais de cada modelo em 2026-10-09.</small></p>
        </div>

        <div class="aviso"><strong>A margem não é o seu lucro.</strong> Ela desconta só o que o programa custa
          para rodar. O seu tempo, que é o custo de verdade de uma mentoria, não está nesta conta.</div>

        <form method="post" action="/setup/precificacao">
          <input type="hidden" name="estado" id="estado">
          <div class="acoes"><button type="submit">Guardar estes números</button>
            <a class="botao calmo" href="/setup">Voltar</a></div>
        </form>
        <script>${script}
        </script>`,
      ),
    );
  });

  app.post<{ Body: { estado?: string } }>('/setup/precificacao', async (req: any, res) => {
    if (!req.mentora) return res.redirect('/entrar');
    try {
      const e = JSON.parse(String(req.body?.estado ?? '{}'));
      const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
      const pac = (p: any) => ({
        nome: String(p?.nome ?? '').slice(0, 120),
        preco: num(p?.preco),
        clientes: num(p?.clientes),
        diag: num(p?.diag, 1),
      });
      await gravarConfig('precificacao_v2', {
        hospedagem: String(e.hospedagem ?? '').slice(0, 30),
        plano: String(e.plano ?? '').slice(0, 30),
        modo: e.modo === 'promo' ? 'promo' : 'renov',
        dominio_ano: num(e.dominio_ano),
        email_mes: num(e.email_mes),
        ia: String(e.ia ?? '').slice(0, 30),
        modelo: String(e.modelo ?? '').slice(0, 30),
        dolar: num(e.dolar, 5.4),
        p1: pac(e.p1),
        p2: pac(e.p2),
      });
      await concluir('precificacao', {});
    } catch {
      /* estado ilegível: não grava nada e volta para a tela */
    }
    return res.redirect('/setup');
  });
}
