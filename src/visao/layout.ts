// Camada de apresentação provisória. O design vai ser refeito; o que está aqui
// existe para a Jessica conseguir navegar e validar o fluxo.
//
// Duas superfícies, conforme a decisão de 2026-10-09:
//   escura (Carta Celeste) na abertura, nas transições e na capa do Mapa
//   clara  no corpo dos formulários e no texto gerado, que é onde se lê e se digita

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
  --noite:#0B1220; --painel:#0E1729; --tinta-clara:#DDE5F2; --suave:#8C9BB5;
  --fraco:#5C6B85; --linha-escura:rgba(190,205,230,.14); --sol:#E8C978;
  --papel:#F7F4EE; --cartao:#FFFFFF; --tinta:#1C2231; --tinta-suave:#5A6377;
  --linha:#E2DCD1; --acento:#8A6A3B; --erro:#8C2F2F; --ok:#2F6B4F;
  --raio:10px; --medida:66ch;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:ui-serif,Georgia,'Times New Roman',serif;background:var(--papel);
  color:var(--tinta);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
body.escuro{background:var(--noite);color:var(--tinta-clara)}

.capa{background:var(--noite);color:var(--tinta-clara);padding:40px 20px;text-align:center}
.capa h1{font-size:30px;font-weight:600;letter-spacing:-.3px}
.capa p{color:var(--suave);margin-top:10px;font-size:16px}
.capa .selo{color:var(--sol);font-size:11px;letter-spacing:2.6px;text-transform:uppercase;
  font-family:ui-sans-serif,system-ui,sans-serif;font-weight:600}

.folha{max-width:720px;margin:0 auto;padding:28px 20px 72px}
.cartao{background:var(--cartao);border:1px solid var(--linha);border-radius:var(--raio);
  padding:24px;margin-bottom:18px}
h2{font-size:23px;font-weight:600;letter-spacing:-.2px;margin-bottom:6px}
h3{font-size:18px;font-weight:600;margin:20px 0 8px}
p{max-width:var(--medida)} p+p{margin-top:12px}
.sub{color:var(--tinta-suave);font-size:15px;max-width:var(--medida)}
small{color:var(--tinta-suave);font-size:14px}
a{color:var(--acento)}

/* progresso: barra no desktop, texto no celular, porque barra fina some em tela pequena */
.trilha{display:flex;gap:5px;margin:18px 0 6px}
.trilha i{flex:1;height:3px;background:var(--linha);border-radius:2px;display:block}
.trilha i.feita{background:var(--acento)}
.trilha i.agora{background:var(--sol)}
.passo-txt{font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;
  color:var(--tinta-suave);letter-spacing:.4px}

.campo{margin:18px 0}
label{display:block;font-weight:600;font-size:16px;margin-bottom:4px}
.dica{font-size:14px;color:var(--tinta-suave);margin-bottom:8px}
input[type=text],input[type=email],input[type=password],input[type=number],textarea,select{
  width:100%;font:inherit;font-size:16px;padding:11px 13px;border:1px solid var(--linha);
  border-radius:8px;background:#fff;color:var(--tinta)}
textarea{min-height:120px;resize:vertical;line-height:1.6}
input:focus,textarea:focus,select:focus{outline:2px solid var(--sol);outline-offset:1px;
  border-color:var(--acento)}
.exemplo{font-size:14px;color:var(--fraco);margin-top:6px;font-style:italic}

button,.botao{font:inherit;font-size:16px;font-weight:600;padding:12px 22px;border-radius:8px;
  border:1px solid var(--acento);background:var(--acento);color:#fff;cursor:pointer;
  min-height:44px;display:inline-block;text-decoration:none;text-align:center}
button:hover,.botao:hover{filter:brightness(1.08)}
button:focus-visible,.botao:focus-visible,a:focus-visible{outline:2px solid var(--sol);outline-offset:2px}
.botao.calmo{background:transparent;color:var(--tinta);border-color:var(--linha)}
.acoes{display:flex;gap:10px;align-items:center;margin-top:22px;flex-wrap:wrap}

.aviso{border-left:3px solid var(--sol);padding:10px 14px;background:#FBF6EA;
  border-radius:0 8px 8px 0;font-size:15px;margin:14px 0}
.erro{border-left:3px solid var(--erro);padding:10px 14px;background:#FBEDED;
  border-radius:0 8px 8px 0;font-size:15px;margin:14px 0;color:var(--erro)}
.ok{border-left:3px solid var(--ok);padding:10px 14px;background:#EDF6F1;
  border-radius:0 8px 8px 0;font-size:15px;margin:14px 0;color:var(--ok)}

table{width:100%;border-collapse:collapse;margin:14px 0;font-size:15px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--linha)}
th{font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:var(--tinta-suave);
  font-family:ui-sans-serif,system-ui,sans-serif}
td.num{text-align:right;font-variant-numeric:tabular-nums}

.lista-etapas{list-style:none}
.lista-etapas li{display:flex;gap:12px;align-items:flex-start;padding:13px 0;
  border-bottom:1px solid var(--linha)}
.lista-etapas li:last-child{border-bottom:0}
.marca{width:26px;height:26px;border-radius:50%;border:1px solid var(--linha);
  display:grid;place-items:center;font-size:13px;flex-shrink:0;
  font-family:ui-sans-serif,system-ui,sans-serif;color:var(--tinta-suave)}
.marca.feita{background:var(--ok);border-color:var(--ok);color:#fff}
.marca.agora{background:var(--sol);border-color:var(--sol);color:#2B2410;font-weight:700}
.etapa-nome{font-weight:600} .etapa-nome a{text-decoration:none;color:var(--tinta)}
.etapa-nome a:hover{color:var(--acento)}

@media(max-width:480px){
  body{font-size:16px}
  .folha{padding:20px 16px 90px}
  .cartao{padding:18px;border-radius:8px}
  .capa{padding:28px 16px}
  .capa h1{font-size:25px}
  .trilha{display:none}
  .acoes{position:sticky;bottom:0;background:var(--papel);padding:12px 0;
    margin:22px -16px 0;padding-left:16px;padding-right:16px;
    border-top:1px solid var(--linha)}
}
@media(prefers-reduced-motion:no-preference){.cartao{transition:border-color .15s}}
`;

export interface OpcoesPagina {
  titulo: string;
  capa?: { selo?: string; titulo: string; sub?: string };
  escuro?: boolean;
}

export function pagina(o: OpcoesPagina, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(o.titulo)}</title>
<style>${CSS}</style>
</head>
<body${o.escuro ? ' class="escuro"' : ''}>
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
