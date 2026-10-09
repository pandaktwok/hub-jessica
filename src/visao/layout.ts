// Camada de apresentação. Estilo editorial: fundo claro de papel, tipografia grande e
// pesada, preto como única cor de ênfase, retângulos sem cantos arredondados.
// O design ainda vai ser refeito pela Jessica; isto existe para ela navegar e validar.
//
// Os nomes de classe (.cartao, .campo, .acoes, .aviso...) são usados pelas telas da
// mentorada também. Mude o visual aqui, não os nomes.

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
:root{
  --papel:#F2F0EC; --faixa:#E7E4DE; --cartao:#FFFFFF; --tinta:#111111;
  --tinta-suave:#5C5A55; --fraco:#8A877F; --linha:#D8D4CC; --linha-forte:#111111;
  --acento:#111111; --sol:#111111; --erro:#9B2C2C; --ok:#2F6B4F; --aviso-fundo:#E9E6DF;
  --noite:#0E0E0E; --tinta-clara:#EFEDE8; --suave:#9C9992; --fonte:'Helvetica Neue',Helvetica,Arial,'Inter',system-ui,sans-serif;
  --medida:68ch;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:var(--fonte);background:var(--papel);color:var(--tinta);font-size:16px;
  line-height:1.6;-webkit-font-smoothing:antialiased}
body.escuro{background:var(--noite);color:var(--tinta-clara)}
a{color:var(--tinta);text-underline-offset:3px}
a:hover{opacity:.7}

/* ---- barra de cima */
.nav{display:flex;align-items:center;gap:28px;padding:16px 32px;background:var(--papel);
  border-bottom:1px solid var(--linha);position:sticky;top:0;z-index:20}
.nav .marca-nav{font-weight:800;letter-spacing:.32em;font-size:14px;text-decoration:none;color:var(--tinta)}
.nav .links{display:flex;gap:22px;flex:1}
.nav .links a,.nav .direita a{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;
  text-decoration:none;font-weight:600}
.nav .direita{display:flex;gap:18px;align-items:center}
.nav .roda{display:inline-flex;align-items:center;gap:7px}
.nav svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.6}
.nav .pasta-nome{font-size:11px;letter-spacing:.08em;color:var(--tinta-suave);text-transform:none;font-weight:500}

/* ---- abertura de página: a palavra grande */
.capa{background:var(--faixa);padding:56px 32px 44px;text-align:left}
.capa{padding-left:max(32px,calc((100% - 1080px)/2));padding-right:max(32px,calc((100% - 1080px)/2))}
.capa .selo{font-size:11px;letter-spacing:.28em;text-transform:uppercase;font-weight:700;
  color:var(--tinta-suave);margin-bottom:18px}
.capa h1{font-size:clamp(34px,7.2vw,92px);font-weight:800;line-height:.96;letter-spacing:-.045em;
  text-transform:uppercase;text-wrap:balance;overflow-wrap:anywhere}
.capa p{color:var(--tinta-suave);margin-top:20px;font-size:17px;max-width:56ch}
body.escuro .capa{background:var(--noite)}
body.escuro .capa .selo,body.escuro .capa p{color:var(--suave)}

.folha{max-width:1080px;margin:0 auto;padding:36px 32px 96px}
.cartao{background:var(--cartao);border:1px solid var(--linha);padding:32px;margin-bottom:22px}
h2{font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;margin-bottom:14px}
h3{font-size:20px;font-weight:800;letter-spacing:-.02em;margin:26px 0 8px}
p{max-width:var(--medida)} p+p{margin-top:12px}
.sub{color:var(--tinta-suave);font-size:15.5px;max-width:var(--medida)}
small{color:var(--tinta-suave);font-size:13.5px}

/* ---- progresso */
.trilha{display:flex;gap:6px;margin:0 0 8px}
.trilha i{flex:1;height:4px;background:var(--linha);display:block}
.trilha i.feita{background:var(--tinta)}
.trilha i.agora{background:var(--tinta);opacity:.45}
.passo-txt{font-size:11px;color:var(--tinta-suave);letter-spacing:.18em;text-transform:uppercase;margin-top:6px}

/* ---- formulário */
.campo{margin:22px 0}
label{display:block;font-weight:700;font-size:14.5px;margin-bottom:5px}
.dica{font-size:14px;color:var(--tinta-suave);margin-bottom:8px}
input[type=text],input[type=email],input[type=password],input[type=number],textarea,select{
  width:100%;font:inherit;font-size:16px;padding:13px 14px;border:1px solid var(--linha);
  border-radius:0;background:#fff;color:var(--tinta);appearance:none}
select{background-image:linear-gradient(45deg,transparent 50%,#111 50%),linear-gradient(135deg,#111 50%,transparent 50%);
  background-position:calc(100% - 20px) 55%,calc(100% - 14px) 55%;background-size:6px 6px;background-repeat:no-repeat;padding-right:38px}
textarea{min-height:120px;resize:vertical;line-height:1.55}
input:focus,textarea:focus,select:focus{outline:0;border-color:var(--tinta);box-shadow:0 0 0 1px var(--tinta)}
.exemplo{font-size:13.5px;color:var(--fraco);margin-top:6px;font-style:italic}
.escolhas{display:flex;flex-wrap:wrap;gap:10px}
.escolhas label{display:inline-flex;align-items:center;gap:9px;font-weight:600;font-size:14.5px;
  border:1px solid var(--linha);background:#fff;padding:11px 16px;cursor:pointer;margin:0}
.escolhas input{width:auto;accent-color:#111}
.escolhas label:has(input:checked){border-color:var(--tinta);background:var(--tinta);color:#fff}
.escolhas label:has(input:checked) input{accent-color:#fff}

button,.botao{font:inherit;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;
  padding:16px 30px;border:1px solid var(--tinta);background:var(--tinta);color:#fff;cursor:pointer;
  min-height:48px;display:inline-block;text-decoration:none;text-align:center;border-radius:0}
button:hover,.botao:hover{opacity:.82}
button:focus-visible,.botao:focus-visible,a:focus-visible{outline:2px solid var(--tinta);outline-offset:3px}
.botao.calmo,button.calmo{background:transparent;color:var(--tinta);border-color:var(--tinta)}
.botao.pequeno,button.pequeno{padding:10px 16px;min-height:38px;font-size:11px}
.acoes{display:flex;gap:12px;align-items:center;margin-top:26px;flex-wrap:wrap}

.aviso{border-left:3px solid var(--tinta);padding:12px 16px;background:var(--aviso-fundo);font-size:15px;margin:16px 0}
.erro{border-left:3px solid var(--erro);padding:12px 16px;background:#F5E6E4;font-size:15px;margin:16px 0;color:var(--erro)}
.ok{border-left:3px solid var(--ok);padding:12px 16px;background:#E7F0EA;font-size:15px;margin:16px 0;color:var(--ok)}

table{width:100%;border-collapse:collapse;margin:14px 0;font-size:15px}
th,td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--linha);vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:var(--tinta-suave);font-weight:700}
td.num{text-align:right;font-variant-numeric:tabular-nums}

/* ---- lista de etapas: número grande à esquerda */
.lista-etapas{list-style:none;counter-reset:e}
.lista-etapas li{display:flex;gap:22px;align-items:flex-start;padding:20px 0;border-bottom:1px solid var(--linha)}
.lista-etapas li:last-child{border-bottom:0}
.marca{min-width:44px;font-size:30px;font-weight:800;letter-spacing:-.04em;line-height:1;color:var(--linha);
  font-variant-numeric:tabular-nums}
.marca.feita{color:var(--ok)}
.marca.agora{color:var(--tinta)}
.etapa-nome{font-weight:800;font-size:19px;letter-spacing:-.02em}
.etapa-nome a{text-decoration:none}

/* ---- faixa preta com números, como as tarjas da referência */
.faixa{background:var(--noite);color:var(--tinta-clara);display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:18px 0}
.faixa>div{padding:22px 24px;background:var(--noite)}
.faixa small{color:var(--suave);letter-spacing:.16em;text-transform:uppercase;font-size:10.5px;font-weight:700;display:block}
.faixa strong{font-size:clamp(22px,3.4vw,34px);font-weight:800;letter-spacing:-.03em;display:block;margin-top:6px;font-variant-numeric:tabular-nums}
.faixa strong.neg{color:#E6A39B}

.duas{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.duas>.cartao{margin-bottom:0;min-width:0}
.duas input,.duas select{min-width:0}
.cartao .duas .cartao{padding:24px}
.duas .faixa>div{padding:16px 14px}
.duas .faixa strong{font-size:clamp(17px,1.9vw,24px)}
.grade>*{min-width:0}
.grade{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.etiqueta{display:inline-block;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;
  border:1px solid var(--tinta);padding:3px 8px}

@media(max-width:760px){
  .capa{padding-left:16px;padding-right:16px}
  .nav{padding:12px 16px;gap:14px;flex-wrap:wrap}
  .nav .links{order:3;flex-basis:100%;gap:16px;overflow-x:auto}
  .capa{padding:34px 16px 28px}
  .folha{padding:22px 16px 96px}
  .cartao{padding:20px}
  .duas,.grade{grid-template-columns:1fr}
  .faixa{grid-template-columns:1fr}
  .lista-etapas li{gap:14px}
  .marca{min-width:34px;font-size:24px}
  .trilha{display:none}
  /* Barra de ação fixa no rodapé; a folga embaixo evita esconder o último campo. */
  form{padding-bottom:12px}
  .acoes{position:sticky;bottom:0;z-index:5;background:var(--papel);margin:22px -20px 0;
    padding:12px 20px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--linha)}
  .cartao{padding-bottom:84px}
}
@media print{.nav,.acoes{display:none}}
`;

export interface OpcoesPagina {
  titulo: string;
  capa?: { selo?: string; titulo: string; sub?: string };
  escuro?: boolean;
  /** Mostra a barra de cima da mentora, com a roda de configuração da IA. */
  admin?: boolean;
}

const SCRIPT_PASTA = `
(function(){
  var BD='hub-pasta',LOJA='h';
  function abrir(){return new Promise(function(ok,no){var r=indexedDB.open(BD,1);
    r.onupgradeneeded=function(){r.result.createObjectStore(LOJA)};
    r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})}
  function ler(){return abrir().then(function(db){return new Promise(function(ok){
    var t=db.transaction(LOJA).objectStore(LOJA).get('pasta');t.onsuccess=function(){ok(t.result||null)};t.onerror=function(){ok(null)}})}).catch(function(){return null})}
  function gravar(h){return abrir().then(function(db){return new Promise(function(ok){
    var t=db.transaction(LOJA,'readwrite');t.objectStore(LOJA).put(h,'pasta');t.oncomplete=function(){ok(true)}})})}
  window.hubPasta={
    suportado:function(){return typeof window.showDirectoryPicker==='function'},
    escolher:function(){return window.showDirectoryPicker({mode:'readwrite',id:'hub-jessica'}).then(function(h){return gravar(h).then(function(){return h})})},
    atual:ler,
    escrever:async function(arquivos){
      var h=await ler();
      if(!h)throw new Error('Nenhuma pasta escolhida ainda.');
      if((await h.queryPermission({mode:'readwrite'}))!=='granted'){
        if((await h.requestPermission({mode:'readwrite'}))!=='granted')throw new Error('O navegador não deixou escrever na pasta.');
      }
      for(var i=0;i<arquivos.length;i++){
        var partes=arquivos[i].caminho.split('/');var dir=h;
        for(var j=0;j<partes.length-1;j++)dir=await dir.getDirectoryHandle(partes[j],{create:true});
        var f=await dir.getFileHandle(partes[partes.length-1],{create:true});
        var w=await f.createWritable();await w.write(arquivos[i].blob||arquivos[i].conteudo);await w.close();
      }
      return h.name;
    }
  };
  document.addEventListener('DOMContentLoaded',function(){
    var el=document.getElementById('pasta-nome');
    if(el)ler().then(function(h){if(h)el.textContent=h.name});
  });
})();
`;

export function pagina(o: OpcoesPagina, corpo: string): string {
  const nav = o.admin
    ? `<nav class="nav" aria-label="Principal">
  <a class="marca-nav" href="/admin">HUB</a>
  <div class="links">
    <a href="/setup">Etapas</a>
    <a href="/admin/mentoradas">Mentoradas</a>
    <a href="/admin/skills">Skills</a>
  </div>
  <div class="direita">
    <a class="roda" href="/setup/pasta" title="Pasta do seu computador">
      <svg viewBox="0 0 24 24"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>
      <span>Pasta</span><span class="pasta-nome" id="pasta-nome"></span>
    </a>
    <a class="roda" href="/config/ia" title="Conectar a inteligência artificial">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5h0a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>
      <span>Conecte a sua IA</span>
    </a>
    <a href="/sair">Sair</a>
  </div>
</nav>`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(o.titulo)}</title>
<style>${CSS}</style>
${o.admin ? `<script>${SCRIPT_PASTA}</script>` : ''}
</head>
<body${o.escuro ? ' class="escuro"' : ''}>
${nav}
${
  o.capa
    ? `<header class="capa">
  ${o.capa.selo ? `<div class="selo">${esc(o.capa.selo)}</div>` : ''}
  <h1>${esc(o.capa.titulo)}</h1>
  ${o.capa.sub ? `<p>${esc(o.capa.sub)}</p>` : ''}
</header>`
    : ''
}
<main class="folha">${corpo}</main>
</body>
</html>`;
}

export function trilha(atual: number, total: number): string {
  const barras = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const classe = n < atual ? 'feita' : n === atual ? 'agora' : '';
    return `<i class="${classe}"></i>`;
  }).join('');
  return `<div class="trilha" role="presentation">${barras}</div>
<div class="passo-txt">Etapa ${atual} de ${total}</div>`;
}
