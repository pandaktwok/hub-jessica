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
// Preço por período: só o de 24 meses da Hostinger (promo R$ 43,99 e renovação R$ 77,99) e o
// preço inicial da HostGator foram conferidos nas páginas. Os demais períodos são estimativas
// editáveis na tela e vêm marcados como tal. Domínio e e-mail também são estimativas.
// Plano único por empresa: Hostinger KVM 2 (2 vCPU, 8 GB) e, como equivalente, HostGator NVMe 8
// (4 vCPU, 8 GB): é a RAM que o programa mais usa, então a comparação é pela RAM.
const DADOS = {
  hospedagem: {
    hostinger: {
      nome: 'Hostinger',
      plano: 'KVM 2 · 2 vCPU · 8 GB · 100 GB NVMe',
      renov: 77.99,
      periodos: [
        { meses: 1, nome: 'Mensal', mes: 77.99, conf: false },
        { meses: 12, nome: 'Anual (12 meses)', mes: 77.99, conf: false },
        { meses: 24, nome: '24 meses', mes: 43.99, conf: true },
      ],
    },
    hostgator: {
      nome: 'HostGator',
      plano: 'VPS NVMe 8 · 4 vCPU · 8 GB · 200 GB NVMe (equivalente ao KVM 2 em memória)',
      renov: null,
      periodos: [
        { meses: 1, nome: 'Mensal', mes: 55.99, conf: false },
        { meses: 12, nome: 'Anual (12 meses)', mes: 55.99, conf: false },
        { meses: 36, nome: '3 anos (36 meses)', mes: 55.99, conf: false },
      ],
    },
  },
  ia: [
    { id: 'claude-haiku', empresa: 'Claude', nome: 'Haiku 5.5', usd: 0.02 },
    { id: 'claude-sonnet', empresa: 'Claude', nome: 'Sonnet 5.5', usd: 0.32 },
    { id: 'claude-opus', empresa: 'Claude', nome: 'Opus 5.5', usd: 0.63 },
    { id: 'gemini-lite', empresa: 'Gemini', nome: '3.5 Flash-Lite', usd: 0.06 },
    { id: 'gemini-flash', empresa: 'Gemini', nome: '3.8 Flash', usd: 0.12 },
    { id: 'gpt-luna', empresa: 'GPT', nome: '5.6 Luna', usd: 0.04 },
    { id: 'gpt-terra', empresa: 'GPT', nome: '5.6 Terra', usd: 0.35 },
  ],
  tokensPorDiagnostico: 94000,
};

const PADRAO = {
  hospedagem: 'hostinger',
  periodo: 24,
  preco_mes: null as number | null,
  usa_vps: true,
  usa_dominio: true,
  usa_email: true,
  dominio_ano: 70,
  email_mes: 0,
  modelo: 'claude-haiku',
  dolar: 5.4,
  planos_ia: [100, 200, 500],
  pacote: { preco: 500, clientes: 20, diag: 1 },
};

const SCRIPT = String.raw`
(function(){
  var D=__DADOS__;
  var E=__ESTADO__;
  var $=function(id){return document.getElementById(id)};
  var brl=function(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};
  var n0=function(v){return Math.round(v).toLocaleString('pt-BR')};
  var num=function(id){var v=parseFloat(String($(id).value).replace(',','.'));return isFinite(v)?v:0};

  var hosp=$('hospedagem'),per=$('periodo'),mod=$('modelo');
  Object.keys(D.hospedagem).forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=D.hospedagem[k].nome;hosp.appendChild(o)});
  hosp.value=E.hospedagem;
  function periodos(){return D.hospedagem[hosp.value].periodos}
  function preencherPeriodos(sel){
    per.innerHTML='';
    periodos().forEach(function(p){var o=document.createElement('option');o.value=p.meses;o.textContent=p.nome;per.appendChild(o)});
    var ok=periodos().filter(function(p){return p.meses==sel})[0];
    per.value=ok?ok.meses:periodos()[periodos().length-1].meses;
  }
  function periodoAtual(){return periodos().filter(function(p){return p.meses==per.value})[0]||periodos()[periodos().length-1]}
  function padraoDoPeriodo(){$('preco_mes').value=periodoAtual().mes}
  D.ia.forEach(function(m){var o=document.createElement('option');o.value=m.id;o.textContent=m.empresa+' '+m.nome;mod.appendChild(o)});
  mod.value=E.modelo;
  preencherPeriodos(E.periodo);
  $('preco_mes').value=E.preco_mes!==null&&E.preco_mes!==undefined?E.preco_mes:periodoAtual().mes;
  ['usa_vps','usa_dominio','usa_email'].forEach(function(k){$(k).checked=!!E[k]});
  ['dominio_ano','email_mes','dolar'].forEach(function(k){$(k).value=E[k]});
  ['preco','clientes','diag'].forEach(function(k){$('pac_'+k).value=E.pacote[k]});
  [0,1,2].forEach(function(i){$('plano_ia'+i).value=E.planos_ia[i]});

  hosp.addEventListener('change',function(){preencherPeriodos(null);padraoDoPeriodo();calcular()});
  per.addEventListener('change',function(){padraoDoPeriodo();calcular()});

  function calcular(){
    var h=D.hospedagem[hosp.value],p=periodoAtual(),meses=Number(p.meses);
    $('plano-nome').textContent=h.plano;
    var vps=$('usa_vps').checked?num('preco_mes'):0;
    var dom=$('usa_dominio').checked?num('dominio_ano')/12:0;
    var ema=$('usa_email').checked?num('email_mes'):0;
    var fixo=vps+dom+ema;
    var total=fixo*meses;

    var aviso=[];
    if(!p.conf)aviso.push('O preço deste período não foi conferido: está como estimativa. Edite o campo se souber o valor do checkout.');
    if(h.renov!==null&&p.conf)aviso.push('Depois do período promocional, a Hostinger renova a '+brl(h.renov)+' por mês.');
    if(h.renov===null)aviso.push('A HostGator publica só o preço inicial. A renovação tende a ser maior.');
    $('nota-servidor').textContent=aviso.join(' ');
    $('nota-servidor').style.display=aviso.length?'block':'none';

    $('total-mes').textContent=brl(fixo);
    $('total-periodo').textContent=meses===1?'Cobrança mensal':'Total para '+meses+' meses: '+brl(total);
    $('detalhe-fixo').textContent='Servidor '+brl(vps)+' + domínio '+brl(dom)+' + e-mail '+brl(ema)+', por mês.';

    var m=D.ia.filter(function(x){return x.id===mod.value})[0]||D.ia[0];
    var dolar=num('dolar');
    var preco=num('pac_preco'),clientes=num('pac_clientes'),diag=num('pac_diag');
    var vol=clientes*diag;
    var custoDiag=m.usd*dolar;
    var iaMes=vol*custoDiag;
    var receita=preco*clientes;
    var margem=receita-fixo-iaMes;

    $('r_receita').textContent=brl(receita);
    $('r_fixo').textContent=brl(fixo);
    $('r_ia').textContent=brl(iaMes);
    var mg=$('r_margem');mg.textContent=brl(margem);mg.className=margem<0?'neg':'';
    $('r_pct').textContent=receita>0?(margem/receita*100).toFixed(0)+'% da receita':'—';
    $('r_cliente').textContent=clientes>0?brl((fixo+iaMes)/clientes):'—';
    $('r_vol').textContent=n0(vol)+' diagnósticos por mês';

    var planos=[0,1,2].map(function(i){return num('plano_ia'+i)});
    var th='<tr><th>Modelo</th><th>Por diagnóstico</th>'+planos.map(function(v){return '<th>Crédito de '+brl(v)+'</th>'}).join('')+'<th>No seu volume</th></tr>';
    var linhas=D.ia.slice().sort(function(a,b){return a.usd-b.usd}).map(function(x){
      var c=x.usd*dolar;
      var cel=planos.map(function(v){
        var q=c>0?Math.floor(v/c):0;
        var cabe=q>=vol;
        var tok=q*D.tokensPorDiagnostico/1e6;
        return '<td class="'+(cabe?'cabe':'nao')+'">'+n0(q)+' diag.<br><small>≈ '+tok.toFixed(1).replace('.',',')+' mi de tokens</small></td>';
      }).join('');
      var mensal=vol*c;
      var minimo=planos.filter(function(v){return v>=mensal}).sort(function(a,b){return a-b})[0];
      return '<tr class="'+(x.id===mod.value?'ativa':'')+'"><td><strong>'+x.empresa+' '+x.nome+'</strong></td><td>'+brl(c)+'</td>'+cel+
        '<td>'+brl(mensal)+'<br><small>'+(minimo!==undefined?'cabe no crédito de '+brl(minimo):'passa do maior crédito')+'</small></td></tr>';
    }).join('');
    $('tabela-ia').innerHTML='<thead>'+th+'</thead><tbody>'+linhas+'</tbody>';
    $('estado').value=JSON.stringify(coletar());
  }

  function coletar(){
    return {hospedagem:hosp.value,periodo:Number(per.value),preco_mes:num('preco_mes'),
      usa_vps:$('usa_vps').checked,usa_dominio:$('usa_dominio').checked,usa_email:$('usa_email').checked,
      dominio_ano:num('dominio_ano'),email_mes:num('email_mes'),modelo:mod.value,dolar:num('dolar'),
      planos_ia:[0,1,2].map(function(i){return num('plano_ia'+i)}),
      pacote:{preco:num('pac_preco'),clientes:num('pac_clientes'),diag:num('pac_diag')}};
  }

  document.querySelectorAll('input,select').forEach(function(el){el.addEventListener('input',calcular);el.addEventListener('change',calcular)});
  calcular();
})();
`;

const ESTILO = `<style>
.preco-grade{display:grid;grid-template-columns:340px minmax(0,1fr);gap:28px;align-items:start;margin-top:22px}
.lateral{position:sticky;top:76px;background:#fff;border:1px solid var(--linha);padding:22px}
.lateral h2{margin-top:0}
.lateral .resultado{margin-top:18px;border-top:2px solid var(--tinta);padding-top:14px}
.lateral .linha{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--linha);font-size:15px}
.lateral .margem{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px}
.lateral .margem strong{font-size:30px;letter-spacing:-.01em}
.neg{color:var(--erro,#b3261e)}
.total-grande{background:var(--tinta);color:#fff;padding:22px 26px;margin:18px 0}
.total-grande strong{display:block;font-size:44px;line-height:1.05;letter-spacing:-.02em}
.total-grande small{color:#d8d4cb;font-size:14px}
.servicos{display:flex;gap:10px;flex-wrap:wrap}
.tabela-rolar{overflow-x:auto}
#tabela-ia td,#tabela-ia th{vertical-align:top;font-size:14px}
#tabela-ia tr.ativa td{background:var(--faixa)}
#tabela-ia td.cabe{font-weight:700}
#tabela-ia td.nao{color:#8a857b}
@media (max-width:900px){.preco-grade{grid-template-columns:1fr}.lateral{position:static}}
</style>`;

export default async function rotasPreco(app: FastifyInstance) {
  app.get('/setup/precificacao', async (req: any, res) => {
    if (!req.mentora) return res.redirect('/entrar');
    const salvo = (await lerConfig<any>('precificacao_v3')) ?? {};
    const estado = {
      ...PADRAO,
      ...salvo,
      pacote: { ...PADRAO.pacote, ...(salvo.pacote ?? {}) },
      planos_ia: Array.isArray(salvo.planos_ia) && salvo.planos_ia.length === 3 ? salvo.planos_ia : PADRAO.planos_ia,
    };
    const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
    const script = SCRIPT.replace('__DADOS__', () => json(DADOS)).replace('__ESTADO__', () => json(estado));

    return res.type('text/html').send(
      molde(
        NUMERO.precificacao,
        'O preço da sua mentoria',
        `${ESTILO}
        <p class="sub">Isto é só para você ter uma noção de quanto sobra: não é o preço final, que a gente ainda
          vai definir juntos. Mude qualquer número e a conta ao lado se ajusta na hora.</p>
        <div class="preco-grade">
          <aside class="lateral" aria-label="Resumo do pacote">
            <h2>Pacote · cobrança mensal</h2>
            <div class="campo"><label for="pac_preco">Quanto você cobra por mês, por cliente (R$)</label>
              <input id="pac_preco" type="number" step="0.01" min="0"></div>
            <div class="campo"><label for="pac_clientes">Média de clientes atendidas</label>
              <input id="pac_clientes" type="number" min="0"></div>
            <div class="campo"><label for="pac_diag">Diagnósticos por cliente, por mês</label>
              <input id="pac_diag" type="number" min="0" step="1"></div>
            <div class="resultado">
              <div class="linha"><span>Receita por mês</span><strong id="r_receita">—</strong></div>
              <div class="linha"><span>Custo fixo (servidor, domínio, e-mail)</span><strong id="r_fixo">—</strong></div>
              <div class="linha"><span>Despesa de IA</span><strong id="r_ia">—</strong></div>
              <div class="margem"><span>Margem</span><strong id="r_margem">—</strong></div>
              <p class="sub"><small id="r_pct"></small></p>
              <p class="sub"><small>Custo por cliente: <strong id="r_cliente">—</strong> por mês.<br>
                Volume: <span id="r_vol"></span>.</small></p>
            </div>
          </aside>

          <div>
            <div class="cartao" style="margin-top:0">
              <h2>Hospedagem</h2>
              <div class="grade">
                <div class="campo"><label for="hospedagem">Empresa</label><select id="hospedagem"></select></div>
                <div class="campo"><label for="periodo">Por quanto tempo você aluga</label><select id="periodo"></select></div>
              </div>
              <p class="sub"><small>Plano: <strong id="plano-nome"></strong></small></p>
              <div class="campo"><label>O que entra na conta</label>
                <div class="escolhas servicos">
                  <label><input type="checkbox" id="usa_vps">Hospedagem (VPS)</label>
                  <label><input type="checkbox" id="usa_dominio">Domínio</label>
                  <label><input type="checkbox" id="usa_email">E-mail profissional</label>
                </div></div>
              <div class="grade">
                <div class="campo"><label for="preco_mes">Servidor, por mês neste período (R$)</label>
                  <input id="preco_mes" type="number" step="0.01" min="0"></div>
                <div class="campo"><label for="dominio_ano">Domínio, por ano (R$)</label>
                  <input id="dominio_ano" type="number" step="0.01" min="0">
                  <div class="exemplo">Preço médio de mercado.</div></div>
              </div>
              <div class="campo" style="max-width:320px"><label for="email_mes">E-mail profissional, por mês (R$)</label>
                <input id="email_mes" type="number" step="0.01" min="0">
                <div class="exemplo">Zero se usar o que já tem.</div></div>
              <div id="nota-servidor" class="aviso" style="display:none"></div>
              <div class="total-grande">
                <small>Custo fixo por mês</small>
                <strong id="total-mes">—</strong>
                <small id="total-periodo"></small><br>
                <small id="detalhe-fixo"></small>
              </div>
            </div>

            <div class="cartao">
              <h2>Inteligência artificial</h2>
              <p class="sub">A referência é sempre o modelo mais barato (Claude Haiku 5.5). Você pode trocar para ver
                o efeito na margem. Cada diagnóstico completo (seis módulos e o Mapa) gasta em média
                <strong>94 mil tokens</strong>.</p>
              <div class="grade">
                <div class="campo"><label for="modelo">Modelo usado na conta</label><select id="modelo"></select></div>
                <div class="campo"><label for="dolar">Dólar (R$)</label>
                  <input id="dolar" type="number" step="0.01" min="0"></div>
              </div>
              <div class="campo"><label>Valores de crédito para comparar (R$ por mês)</label>
                <div class="grade" style="grid-template-columns:repeat(3,1fr)">
                  <input id="plano_ia0" type="number" min="0" step="1" aria-label="Primeiro crédito">
                  <input id="plano_ia1" type="number" min="0" step="1" aria-label="Segundo crédito">
                  <input id="plano_ia2" type="number" min="0" step="1" aria-label="Terceiro crédito">
                </div>
                <div class="exemplo">Quantos diagnósticos cada valor paga, por modelo. Em negrito, o que cobre o seu volume.
                  Vale para crédito de API (paga por uso); assinaturas de chat não servem para rodar o programa.</div>
              </div>
              <div class="tabela-rolar"><table id="tabela-ia"></table></div>
              <p class="sub"><small>Custo por diagnóstico calculado pelos preços oficiais de cada modelo em 2026-10-09.</small></p>
            </div>

            <div class="aviso"><strong>A margem não é o seu lucro.</strong> Ela desconta só o que o programa custa
              para rodar. O seu tempo, que é o custo de verdade de uma mentoria, não está nesta conta.</div>

            <form method="post" action="/setup/precificacao">
              <input type="hidden" name="estado" id="estado">
              <div class="acoes"><button type="submit">Guardar estes números</button>
                <a class="botao calmo" href="/setup">Voltar</a></div>
            </form>
          </div>
        </div>
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
      await gravarConfig('precificacao_v3', {
        hospedagem: e.hospedagem === 'hostgator' ? 'hostgator' : 'hostinger',
        periodo: num(e.periodo, 24),
        preco_mes: num(e.preco_mes),
        usa_vps: !!e.usa_vps,
        usa_dominio: !!e.usa_dominio,
        usa_email: !!e.usa_email,
        dominio_ano: num(e.dominio_ano, 70),
        email_mes: num(e.email_mes),
        modelo: String(e.modelo ?? 'claude-haiku').slice(0, 40),
        dolar: num(e.dolar, 5.4),
        planos_ia: [0, 1, 2].map((i) => num(e.planos_ia?.[i], [100, 200, 500][i])),
        pacote: {
          preco: num(e.pacote?.preco),
          clientes: num(e.pacote?.clientes),
          diag: num(e.pacote?.diag, 1),
        },
      });
      await concluir('precificacao', {});
    } catch {
      /* estado ilegível: não grava nada e volta para a tela */
    }
    return res.redirect('/setup');
  });
}
