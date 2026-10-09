/* Second Brain — motor da constelação orbital.
   Geometria fixa: núcleo, depois 4 camadas com GAP IGUAL entre elas.
   Dentro de cada camada os pontos preenchem um anel; quando lota,
   abre outro anel logo abaixo. Nunca invade o núcleo nem a vizinha. */

const NS = 'http://www.w3.org/2000/svg';

const CATS = [
  { key: 'business',  label: 'Business',  share: .42 },
  { key: 'content',   label: 'Content',   share: .26 },
  { key: 'personal',  label: 'Personal',  share: .20 },
  { key: 'community', label: 'Community', share: .12 },
];
const TOTAL_FILES = 1247;

const SKILLS = ['Organizar','Indexar','Limpar','Resumir','Classificar','Conectar','Exportar','Analisar'];
const ROUTINES = ['Resumo diário','Arquivar','Backup','Relatório semanal','Curadoria','Faxina'];
const APPS = ['Notion','Gmail','Calendar','Drive','WhatsApp'];

const NAMES = {
  business:['Proposta comercial','Precificação 2026','Contrato mentoria','Planilha de metas','Funil de vendas','Script de atendimento','Relatório mensal','Análise de concorrência','Persona clínica','Pacote de serviços'],
  content:['Roteiro Reels','Carrossel Instagram','Legenda do post','Newsletter semanal','Roteiro de aula','E-book capítulo','Story sequência','Artigo de blog','Podcast notas','Copy da bio'],
  personal:['Leitura — anotações','Diário de bordo','Reflexão semanal','Curso — resumo','Livro destacado','Ideia solta','Meta trimestral','Aprendizado do dia','Retrospectiva','Hábito em teste'],
  community:['Turma 3 — notas','Dúvidas frequentes','Feedback mentorada','TCC revisão','Grupo WhatsApp','Encontro ao vivo','Depoimento','Caso de sucesso','Checklist aluna','Mural de dúvidas'],
};
const EXT = { business:['pdf','xlsx','docx'], content:['md','docx','pdf'], personal:['md','txt','md'], community:['md','pdf','docx'] };

function el(t, a = {}) { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; }

function buildFiles() {
  const out = []; let id = 0;
  CATS.forEach(c => {
    const n = Math.round(TOTAL_FILES * c.share);
    for (let i = 0; i < n; i++) {
      const base = NAMES[c.key][i % NAMES[c.key].length];
      const d = new Date(2026, 0, 1 + ((i * 37) % 270));
      out.push({
        id: id++, cat: c,
        name: `${base} ${String(i + 1).padStart(3, '0')}.${EXT[c.key][i % 3]}`,
        size: (12 + (i * 53) % 680) + ' KB',
        date: d.toLocaleDateString('pt-BR'),
      });
    }
  });
  return out.slice(0, TOTAL_FILES);
}

/* empilha sub-anéis dentro de uma camada */
function ringsFor(count, startR, step, arc) {
  const rings = []; let r = startR, left = count;
  while (left > 0) {
    const cap = Math.max(4, Math.floor((2 * Math.PI * r) / arc));
    const take = Math.min(cap, left);
    rings.push({ r, take });
    left -= take; r += step;
  }
  return { rings, outer: rings[rings.length - 1].r };
}

/* T = tema da variante */
function renderOrbital(svg, T) {
  const CX = 400, CY = 400;
  const { nucleus, gap, step, arc } = T.geo;
  const FILES = buildFiles();

  const gGuides = el('g'), gApps = el('g'), gRout = el('g'), gMem = el('g'), gSkills = el('g'),
        gCat = el('g'), gLabels = el('g');
  gApps.setAttribute('class', 'ring r-apps');
  gRout.setAttribute('class', 'ring r-routines');
  gMem.setAttribute('class', 'ring r-memory');
  gSkills.setAttribute('class', 'ring r-skills');

  const defs = el('defs');
  if (T.handDrawn) {
    defs.innerHTML = `<filter id="ink" x="-6%" y="-6%" width="112%" height="112%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;
  }
  svg.appendChild(defs);
  [gGuides, gApps, gRout, gMem, gSkills, gCat, gLabels].forEach(g => svg.appendChild(g));

  const inkAttr = T.handDrawn ? { filter: 'url(#ink)' } : {};

  function guide(r, strong) {
    gGuides.appendChild(el('circle', Object.assign({
      cx: CX, cy: CY, r, fill: 'none',
      stroke: strong ? T.c.orbitStrong : T.c.orbit,
      'stroke-width': T.orbitWidth || 1,
    }, inkAttr)));
    if (T.ticks && strong) {
      const tg = el('g');
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * 2 * Math.PI;
        const len = i % 6 === 0 ? 6 : 3;
        tg.appendChild(el('line', {
          x1: CX + Math.cos(a) * r, y1: CY + Math.sin(a) * r,
          x2: CX + Math.cos(a) * (r + len), y2: CY + Math.sin(a) * (r + len),
          stroke: T.c.orbit, 'stroke-width': .6,
        }));
      }
      gGuides.appendChild(tg);
    }
  }

  function ringLabel(r, text) {
    const w = text.length * 6.4 + 16;
    gLabels.appendChild(el('rect', { x: CX - w / 2, y: CY - r - 7, width: w, height: 13, fill: T.c.bg, rx: 2 }));
    const t = el('text', { class: 'ring-label', x: CX, y: CY - r + 2, 'text-anchor': 'middle' });
    t.textContent = text; gLabels.appendChild(t);
  }

  function dot(g, x, y, r, fill, meta, extra = {}) {
    const c = el('circle', Object.assign({ class: 'dot', cx: x, cy: y, r, fill }, extra));
    c.dataset.meta = JSON.stringify(meta);
    g.appendChild(c);
    return c;
  }

  function simpleLayer(g, items, startR, color, dotR, layerName, counterClass, withLabels) {
    const L = ringsFor(items.length, startR, step, arc);
    L.rings.forEach(ring => {
      guide(ring.r, true);
      for (let k = 0; k < ring.take; k++) {
        const a = (k / ring.take) * 2 * Math.PI - Math.PI / 2;
        const x = CX + Math.cos(a) * ring.r, y = CY + Math.sin(a) * ring.r;
        dot(g, x, y, dotR, color, { name: items[k], layer: layerName, color, cat: layerName });
        if (withLabels) {
          const wrap = el('g'); wrap.setAttribute('transform', `translate(${x} ${y})`);
          const cc = el('g', { class: counterClass });
          const t = el('text', { class: 'node-label', 'text-anchor': 'middle', y: dotR + 14 });
          t.textContent = items[k]; cc.appendChild(t); wrap.appendChild(cc); g.appendChild(wrap);
        }
      }
    });
    return L;
  }

  /* 1 · SKILLS */
  const L1 = simpleLayer(gSkills, SKILLS, nucleus + gap, T.c.skills, T.dots.skills, 'Skill', 'c-skills', T.labels.skills);
  ringLabel(L1.outer, 'Skills');

  /* 2 · MEMÓRIAS */
  const L2 = ringsFor(FILES.length, L1.outer + gap, step, arc);
  let acc = 0;
  const bounds = CATS.map(c => { const s = acc; acc += c.share; return { c, s, e: acc, color: T.c.cat[c.key] }; });
  let idx = 0;
  L2.rings.forEach((ring, ri) => {
    if (ri === 0 || ri === L2.rings.length - 1) guide(ring.r, false);
    for (let k = 0; k < ring.take; k++) {
      const frac = k / ring.take;
      const b = bounds.find(b => frac >= b.s && frac < b.e) || bounds[bounds.length - 1];
      const a = frac * 2 * Math.PI - Math.PI / 2;
      const f = FILES[idx % FILES.length];
      const mag = T.magnitude ? (0.6 + ((idx * 17) % 10) / 10) : 1;
      dot(gMem, CX + Math.cos(a) * ring.r, CY + Math.sin(a) * ring.r,
          +(T.dots.memory * mag).toFixed(2), b.color,
          { name: f.name, layer: 'Memória', cat: b.c.label, color: b.color, size: f.size, date: f.date },
          T.magnitude ? { 'fill-opacity': (.55 + mag * .35).toFixed(2) } : {});
      idx++;
    }
  });
  bounds.forEach(b => {
    const mid = (b.s + b.e) / 2, a = mid * 2 * Math.PI - Math.PI / 2, rr = L2.outer + 22;
    const x = CX + Math.cos(a) * rr, y = CY + Math.sin(a) * rr;
    const t = el('text', { class: 'cat-label', x, y, 'text-anchor': 'middle', fill: b.color });
    t.textContent = b.c.label; gCat.appendChild(t);
    const n = el('text', { class: 'node-label', x, y: y + 13, 'text-anchor': 'middle' });
    n.textContent = Math.round(TOTAL_FILES * b.c.share) + ' arquivos'; gCat.appendChild(n);
  });
  ringLabel(L2.outer + 40, 'Memórias');

  /* 3 · ROTINAS */
  const L3 = simpleLayer(gRout, ROUTINES, L2.outer + gap + 34, T.c.routines, T.dots.routines, 'Rotina', 'c-routines', T.labels.outer);
  ringLabel(L3.outer, 'Rotinas');

  /* 4 · APPS */
  const L4 = simpleLayer(gApps, APPS, L3.outer + gap, T.c.apps, T.dots.apps, 'Aplicativo', 'c-apps', T.labels.outer);
  ringLabel(L4.outer, 'Apps');

  /* NÚCLEO */
  if (T.halo) {
    const hg = el('radialGradient', { id: 'haloG' });
    hg.innerHTML = `<stop offset="0%" stop-color="${T.c.sun}" stop-opacity=".30"/><stop offset="100%" stop-color="${T.c.sun}" stop-opacity="0"/>`;
    defs.appendChild(hg);
    svg.appendChild(el('circle', { class: 'sun-halo', cx: CX, cy: CY, r: nucleus * 2.4, fill: 'url(#haloG)' }));
  }
  svg.appendChild(el('circle', Object.assign({ cx: CX, cy: CY, r: nucleus, fill: T.c.sun }, inkAttr)));
  if (T.sunRule) svg.appendChild(el('circle', { cx: CX, cy: CY, r: nucleus - 5, fill: 'none', stroke: T.c.sunInk, 'stroke-opacity': .35 }));
  const s1 = el('text', { x: CX, y: CY - 1, 'text-anchor': 'middle', class: 'sun-label', fill: T.c.sunInk });
  s1.textContent = 'CLAUDE'; svg.appendChild(s1);
  const s2 = el('text', { x: CX, y: CY + 11, 'text-anchor': 'middle', class: 'sun-sub', fill: T.c.sunInk });
  s2.textContent = '.MD'; svg.appendChild(s2);

  return { FILES };
}

/* interação: tooltip + preview */
function wireInteraction(svg, tip, preview, T) {
  let sel = null;
  svg.addEventListener('mousemove', e => {
    const t = e.target;
    if (t.classList && t.classList.contains('dot')) {
      const m = JSON.parse(t.dataset.meta);
      tip.innerHTML = `<b>${m.name}</b><br><small>${m.cat}${m.size ? ' · ' + m.size : ''}</small>`;
      tip.style.opacity = '1';
      tip.style.left = Math.min(e.clientX + 14, innerWidth - 250) + 'px';
      tip.style.top = (e.clientY + 14) + 'px';
    } else tip.style.opacity = '0';
  });
  svg.addEventListener('mouseleave', () => tip.style.opacity = '0');
  svg.addEventListener('click', e => {
    const t = e.target;
    if (!(t.classList && t.classList.contains('dot'))) return;
    if (sel) sel.classList.remove('sel');
    t.classList.add('sel'); sel = t;
    const m = JSON.parse(t.dataset.meta);
    preview.innerHTML = `
      <div class="pv-head">
        <div class="pv-kicker"><span class="swatch" style="background:${m.color}"></span>${m.layer} · ${m.cat}</div>
        <div class="pv-title">${m.name}</div>
        <div class="pv-meta">${m.size || '—'} · ${m.date || '—'}</div>
      </div>
      <div class="pv-body">${bodyFor(m)}</div>
      <div class="pv-actions"><button class="pv-btn">Abrir</button><button class="pv-btn">Rodar skill</button></div>`;
  });
}
function bodyFor(m) {
  if (m.layer === 'Skill') return 'Procedimento salvo como SKILL.md. Pode rodar sobre qualquer arquivo do second brain, de qualquer categoria.';
  if (m.layer === 'Rotina') return 'Roda sozinha no horário marcado e grava o resultado na camada de memórias, já classificado.';
  if (m.layer === 'Aplicativo') return 'Conectado à conta da Jessica. Tudo que entra por aqui é indexado automaticamente.';
  return 'Trecho indexado do arquivo. O conteúdo completo abre no painel expandido, com as conexões para outros arquivos da mesma categoria e as skills que já rodaram sobre ele.';
}
