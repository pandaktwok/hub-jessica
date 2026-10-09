import { createHash } from 'node:crypto';
import { q, um, lerConfig } from './db.ts';
import { gerar, configIA } from './ia/index.ts';
import { avaliar } from './verificador.ts';
import { blocoEstilo } from './persona.ts';

// Orçamento de contexto. Sem isto, no módulo 6 o prompt carrega cinco módulos de saída
// mais todas as respostas, e a geração estoura os 30 segundos justamente no módulo que
// a mentorada mais esperou. O corte é por tamanho, do mais antigo para o mais novo.
const TETO_CONTEXTO = 24_000; // caracteres, não tokens: mais barato de medir e conservador

export interface Modulo {
  numero: number;
  titulo: string;
}

// Títulos conforme a Especificação Funcional da Jessica. Não renomeie sem o documento.
export const MODULOS: Modulo[] = [
  { numero: 1, titulo: 'Diagnóstico de Cliente Ideal' },
  { numero: 2, titulo: 'Mapa de Forças e Ativos' },
  { numero: 3, titulo: 'Nome do Método' },
  { numero: 4, titulo: 'Precificação Sugerida' },
  { numero: 5, titulo: 'Protocolos e Ofertas' },
  { numero: 6, titulo: 'Posicionamento em Redes Sociais' },
];

async function textoPrompt(slug: string): Promise<string> {
  const p = await um<{ texto_fabrica: string; texto_mentora: string | null }>(
    'SELECT texto_fabrica, texto_mentora FROM prompts WHERE slug = $1',
    [slug],
  );
  if (!p) return '';
  return p.texto_mentora ?? p.texto_fabrica;
}

async function sistemaComPerfil(): Promise<string> {
  const base = await textoPrompt('_sistema');
  const perfil = (await lerConfig<any>('perfil')) ?? {};
  const estilo = blocoEstilo(perfil);
  return base.replaceAll('{{MENTORA}}', perfil.nome || 'sua mentora') + (estilo ? `\n\n${estilo}` : '');
}

/** Material que a mentora subiu, recortado para caber no orçamento. */
async function materialDoModulo(modulo: number, teto: number): Promise<string> {
  const mats = await q<{ nome: string; conteudo: string | null }>(
    `SELECT nome || coalesce(' (citação: ' || citacao || ')', '') AS nome, conteudo FROM materiais
      WHERE coalesce(modulo,0) IN (0, $1) AND conteudo IS NOT NULL
      ORDER BY (coalesce(modulo,0) = $1) DESC, criado_em`,
    [modulo],
  );
  let acumulado = '';
  for (const m of mats) {
    const bloco = `\n--- ${m.nome} ---\n${m.conteudo}\n`;
    if (acumulado.length + bloco.length > teto) {
      acumulado += bloco.slice(0, Math.max(0, teto - acumulado.length));
      break;
    }
    acumulado += bloco;
  }
  return acumulado;
}

/** Respostas de um módulo, com o rótulo da pergunta junto. */
async function respostasDoModulo(diagnosticoId: string, modulo: number): Promise<string> {
  const rs = await q<{ rotulo: string; valor: string }>(
    `SELECT p.rotulo, r.valor
       FROM respostas r JOIN perguntas p ON p.modulo = r.modulo AND p.campo = r.campo
      WHERE r.diagnostico_id = $1 AND r.modulo = $2
      ORDER BY p.ordem`,
    [diagnosticoId, modulo],
  );
  return rs.map((r) => `${r.rotulo}\n${r.valor}`).join('\n\n');
}

/** Saídas aceitas dos módulos anteriores, das mais recentes para as mais antigas. */
async function contextoAnterior(diagnosticoId: string, ateModulo: number, teto: number) {
  const gs = await q<{ modulo: number; conteudo: any; conteudo_editado: any }>(
    `SELECT DISTINCT ON (modulo) modulo, conteudo, conteudo_editado
       FROM geracoes
      WHERE diagnostico_id = $1 AND modulo < $2 AND estado = 'aceita'
      ORDER BY modulo, versao DESC`,
    [diagnosticoId, ateModulo],
  );
  // Do mais novo para o mais velho: se cortar, corta o mais distante.
  const ordenadas = [...gs].sort((a, b) => b.modulo - a.modulo);
  let acumulado: string[] = [];
  let tamanho = 0;
  for (const g of ordenadas) {
    const titulo = MODULOS.find((m) => m.numero === g.modulo)?.titulo ?? `Módulo ${g.modulo}`;
    const corpo = JSON.stringify(g.conteudo_editado ?? g.conteudo, null, 1);
    const bloco = `\n### Módulo ${g.modulo} — ${titulo} (já aceito por ela)\n${corpo}\n`;
    if (tamanho + bloco.length > teto) break;
    acumulado.push(bloco);
    tamanho += bloco.length;
  }
  return acumulado.reverse().join('');
}

/** O módulo 4 tem aritmética. Quem calcula é o código, não o modelo. */
async function numerosModulo4(diagnosticoId: string): Promise<string> {
  const rs = await q<{ campo: string; valor: string }>(
    'SELECT campo, valor FROM respostas WHERE diagnostico_id = $1 AND modulo = 4',
    [diagnosticoId],
  );
  return calcularNumeros4(rs);
}

export function calcularNumeros4(rs: { campo: string; valor: string }[]): string {
  const v = (c: string) => {
    const n = Number(String(rs.find((r) => r.campo === c)?.valor ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  // Fórmula da Especificação Funcional, seção do módulo 4:
  // valor da hora = (valor médio do atendimento x atendimentos por semana) / horas por semana
  const valorMedio = v('valor_medio');
  const atendSemana = v('atend_semana');
  const horasDia = v('horas_dia');
  const custoFixo = v('custo_fixo');

  const horasSemana = horasDia * 5;
  const valorHora = horasSemana > 0 ? (valorMedio * atendSemana) / horasSemana : 0;
  const receitaSemana = valorMedio * atendSemana;
  const receitaMes = receitaSemana * 4.33;
  const atendMes = atendSemana * 4.33;
  const sobra = receitaMes - custoFixo;
  const precoEquilibrio = atendMes > 0 ? custoFixo / atendMes : 0;

  const brl = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return `NÚMEROS JÁ CALCULADOS (use exatamente estes, não refaça conta nenhuma):
- Valor médio por atendimento, hoje: ${brl(valorMedio)}
- Atendimentos por semana: ${atendSemana}
- Horas de atendimento por dia: ${horasDia} (${horasSemana} por semana, considerando 5 dias)
- Valor da hora atual: ${brl(valorHora)}
- Receita semanal: ${brl(receitaSemana)}
- Receita mensal aproximada: ${brl(receitaMes)} (${Math.round(atendMes)} atendimentos)
${custoFixo > 0 ? `- Custo fixo mensal: ${brl(custoFixo)}
- Sobra mensal depois do custo fixo: ${brl(sobra)}
- Preço de equilíbrio por atendimento: ${brl(precoEquilibrio)}` : '- Ela não informou custo fixo, então não há ponto de equilíbrio para citar.'}`;
}

export interface ResultadoGeracao {
  geracaoId: string;
  estado: 'rascunho' | 'falhou';
  bloqueado?: boolean;
}

/**
 * Gera um módulo. Cria a linha com estado 'gerando' ANTES de chamar a IA, para a tela
 * poder mostrar progresso e para um segundo clique não disparar outra chamada paga.
 */
export async function gerarModulo(
  diagnosticoId: string,
  modulo: number,
): Promise<ResultadoGeracao> {
  const emVoo = await um<{ id: string }>(
    `SELECT id FROM geracoes
      WHERE diagnostico_id = $1 AND modulo = $2 AND estado = 'gerando'
        AND iniciado_em > now() - interval '3 minutes'`,
    [diagnosticoId, modulo],
  );
  if (emVoo) return { geracaoId: emVoo.id, estado: 'rascunho' };

  const linha = await um<{ id: string }>(
    `INSERT INTO geracoes (diagnostico_id, modulo, estado) VALUES ($1, $2, 'gerando') RETURNING id`,
    [diagnosticoId, modulo],
  );
  const geracaoId = linha!.id;

  // Não esperamos aqui: a tela mostra "gerando" e consulta o estado.
  executar(geracaoId, diagnosticoId, modulo).catch(async (e) => {
    await q(
      `UPDATE geracoes SET estado = 'falhou', erro = $2, concluido_em = now() WHERE id = $1`,
      [geracaoId, String(e?.message ?? e).slice(0, 1000)],
    );
  });

  return { geracaoId, estado: 'rascunho' };
}

async function executar(geracaoId: string, diagnosticoId: string, modulo: number) {
  const sistema = await sistemaComPerfil();
  const instrucoes = await textoPrompt(`modulo-${modulo}`);
  const respostas = await respostasDoModulo(diagnosticoId, modulo);

  // Reparte o orçamento: o material da mentora e o contexto anterior dividem o que sobra.
  const fixo = sistema.length + instrucoes.length + respostas.length;
  const disponivel = Math.max(2000, TETO_CONTEXTO - fixo);
  const material = await materialDoModulo(modulo, Math.floor(disponivel * 0.45));
  const anterior = await contextoAnterior(diagnosticoId, modulo, Math.floor(disponivel * 0.55));
  const numeros = modulo === 4 ? await numerosModulo4(diagnosticoId) : '';

  const usuario = [
    material ? `## Material de referência da mentora\n${material}` : '',
    anterior ? `## O que já foi construído neste diagnóstico\n${anterior}` : '',
    numeros,
    `## Respostas dela neste módulo\n${respostas}`,
    `## O que fazer\n${instrucoes}`,
    'Devolva apenas o JSON pedido, sem texto antes nem depois, sem cercas de código.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const cfg = await configIA();
  let ultima: any = null;

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const r = await gerar({ sistema, usuario, maxTokens: 3000 }, cfg);
    ultima = r;
    const veredito = avaliar(r.texto, tentativa);

    if (veredito.acao === 'regerar') continue;

    if (veredito.acao === 'bloquear') {
      await q(
        `UPDATE geracoes
            SET estado = 'falhou', clinico_ok = false, concluido_em = now(),
                erro = $2, provedor = $3, modelo = $4, tokens_in = $5, tokens_out = $6,
                custo_centavos = $7, prompt_hash = $8, prompt_texto = $9
          WHERE id = $1`,
        [
          geracaoId,
          `BLOQUEADO: ${veredito.clinico.map((c) => c.motivo).join('; ')}`,
          r.provedor, r.modelo, r.tokensIn, r.tokensOut, r.custoCentavos,
          createHash('sha256').update(sistema + usuario).digest(),
          (sistema + '\n\n' + usuario).slice(0, 200_000),
        ],
      );
      return;
    }

    await q(
      `UPDATE geracoes
          SET conteudo = $2, estado = 'rascunho', glossario_ok = $3, clinico_ok = true,
              provedor = $4, modelo = $5, tokens_in = $6, tokens_out = $7,
              custo_centavos = $8, prompt_hash = $9, prompt_texto = $10, concluido_em = now()
        WHERE id = $1`,
      [
        geracaoId,
        JSON.stringify(parseSaida(r.texto)),
        veredito.glossario.length === 0,
        r.provedor, r.modelo, r.tokensIn, r.tokensOut, r.custoCentavos,
        createHash('sha256').update(sistema + usuario).digest(),
        (sistema + '\n\n' + usuario).slice(0, 200_000),
      ],
    );
    return;
  }

  // Duas tentativas e o glossário insistiu: mostra assim mesmo, marcado.
  await q(
    `UPDATE geracoes
        SET conteudo = $2, estado = 'rascunho', glossario_ok = false, concluido_em = now(),
            provedor = $3, modelo = $4, tokens_in = $5, tokens_out = $6, custo_centavos = $7
      WHERE id = $1`,
    [
      geracaoId,
      JSON.stringify(parseSaida(ultima?.texto ?? '')),
      ultima?.provedor, ultima?.modelo, ultima?.tokensIn, ultima?.tokensOut, ultima?.custoCentavos,
    ],
  );
}

/** Modelos às vezes embrulham o JSON em cerca de código ou em texto. */
export function parseSaida(texto: string): any {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(limpo);
  } catch {
    const i = limpo.indexOf('{');
    const f = limpo.lastIndexOf('}');
    if (i >= 0 && f > i) {
      try {
        return JSON.parse(limpo.slice(i, f + 1));
      } catch {
        /* cai no texto corrido */
      }
    }
    return { texto: limpo };
  }
}

export async function gerarMapa(diagnosticoId: string): Promise<{ mapaId: string }> {
  const emVoo = await um<{ id: string }>(
    `SELECT id FROM mapas WHERE diagnostico_id = $1 AND estado = 'gerando'
       AND iniciado_em > now() - interval '5 minutes'`,
    [diagnosticoId],
  );
  if (emVoo) return { mapaId: emVoo.id };

  const linha = await um<{ id: string }>(
    `INSERT INTO mapas (diagnostico_id) VALUES ($1) RETURNING id`,
    [diagnosticoId],
  );
  const mapaId = linha!.id;

  (async () => {
    const sistema = await sistemaComPerfil();
    const instrucoes = await textoPrompt('mapa');
    const tudo = await contextoAnterior(diagnosticoId, 7, 40_000);
    const r = await gerar(
      {
        sistema,
        usuario: `## Os seis módulos aceitos por ela\n${tudo}\n\n## O que fazer\n${instrucoes}\n\nDevolva apenas o JSON.`,
        maxTokens: 6000,
      },
    );
    const veredito = avaliar(r.texto, 2);
    if (veredito.acao === 'bloquear') {
      await q(`UPDATE mapas SET estado='falhou', erro=$2, concluido_em=now() WHERE id=$1`,
        [mapaId, 'BLOQUEADO: conteúdo clínico no Mapa']);
      return;
    }
    await q(
      `UPDATE mapas SET conteudo=$2, estado='pronto', provedor=$3, modelo=$4,
              tokens_in=$5, tokens_out=$6, custo_centavos=$7, concluido_em=now() WHERE id=$1`,
      [mapaId, JSON.stringify(parseSaida(r.texto)), r.provedor, r.modelo, r.tokensIn, r.tokensOut, r.custoCentavos],
    );
  })().catch(async (e) => {
    await q(`UPDATE mapas SET estado='falhou', erro=$2, concluido_em=now() WHERE id=$1`,
      [mapaId, String(e?.message ?? e).slice(0, 1000)]);
  });

  return { mapaId };
}


// ---------------------------------------------------------------------------
// Ciclo do módulo (fase de configuração da mentora):
//   1. gerarSkillDoModulo: uma IA lê respostas de exemplo + documentos + observações
//      e escreve a skill do módulo, sempre do zero (evita conflito com a versão antiga).
//   2. gerarExemplo: outra chamada aplica essa skill às respostas e escreve o texto
//      que sai em PDF para a mentora dar feedback.
// A IA que escreve a skill não é avisada para onde a skill vai: a revisão fica com o Renan.
// ---------------------------------------------------------------------------

const SISTEMA_SKILL = `Você transforma o método de um especialista em instruções operacionais reutilizáveis.

Dado o material de referência, as respostas de exemplo e as observações do especialista,
escreva UMA skill: o procedimento que outra pessoa seguiria, sem ter lido o material, para
produzir o texto deste módulo no jeito dele.

Regras:
- Tire o método do material e das observações, não do seu conhecimento geral.
- Cada instrução precisa mudar o resultado de quem segue. "Seja empático" não serve.
  "Peça o exemplo de uma cliente real antes de generalizar" serve.
- Use as palavras do especialista quando ele tiver um jeito próprio de nomear as coisas.
- Se as observações corrigem algo, a observação vale mais que o material.
- Inclua na skill a estrutura exata da saída que o módulo exige.
- Escreva em português do Brasil.`;

function slug(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

async function respostasExemplo(modulo: number) {
  return q<{ campo: string; rotulo: string; valor: string }>(
    `SELECT p.campo, p.rotulo, e.valor
       FROM exemplos e JOIN perguntas p ON p.modulo = e.modulo AND p.campo = e.campo
      WHERE e.modulo = $1 AND btrim(e.valor) <> '' ORDER BY p.ordem`,
    [modulo],
  );
}

export async function gerarSkillDoModulo(
  modulo: number,
): Promise<{ ok: boolean; erro?: string; skillId?: string; nome?: string }> {
  const rs = await respostasExemplo(modulo);
  if (!rs.length) return { ok: false, erro: 'Responda pelo menos uma pergunta de entrada antes de gerar.' };

  const titulo = MODULOS.find((m) => m.numero === modulo)!.titulo;
  const estrutura = await textoPrompt(`modulo-${modulo}`);
  const respostas = rs.map((r) => `${r.rotulo}\n${r.valor}`).join('\n\n');
  const obs = await q<{ texto: string; nome_arquivo: string | null }>(
    'SELECT texto, nome_arquivo FROM observacoes WHERE modulo = $1 ORDER BY criado_em',
    [modulo],
  );
  const observacoes = obs
    .map((o, i) => `Observação ${i + 1}${o.nome_arquivo ? ` (${o.nome_arquivo})` : ''}:\n${o.texto}`)
    .join('\n\n');

  const fixo = SISTEMA_SKILL.length + estrutura.length + respostas.length + observacoes.length;
  const material = await materialDoModulo(modulo, Math.max(3000, TETO_CONTEXTO - fixo));

  const usuario = `SKILL_DO_MODULO
## Material de referência
${material || '(nenhum documento enviado)'}

## Exemplo de preenchimento (respostas dela)
${respostas}

${observacoes ? `## Observações dela sobre as versões anteriores\n${observacoes}\n\n` : ''}## O módulo
Módulo ${modulo} — ${titulo}.

## Estrutura da saída que a skill deve exigir
${estrutura}

## Sua tarefa
Escreva a skill deste módulo, do zero.

Devolva apenas JSON, sem texto antes nem depois, sem cercas de código:
{"nome":"identificador-curto-com-hifens","descricao":"uma linha dizendo o que faz","quando_usar":"em que situação se aplica","instrucoes":"o procedimento em passos, mais a estrutura exata da saída"}`;

  try {
    const cfg = await configIA();
    const r = await gerar({ sistema: SISTEMA_SKILL, usuario, maxTokens: 4000 }, cfg);
    const s = parseSaida(r.texto);
    const instrucoes =
      typeof s?.instrucoes === 'string' ? s.instrucoes : JSON.stringify(s?.instrucoes ?? s?.texto ?? '', null, 1);
    if (!instrucoes.trim()) return { ok: false, erro: 'A IA não devolveu uma skill legível. Tente de novo.' };

    const nome = `modulo-${modulo}-${slug(String(s?.nome ?? '')) || 'escrita'}`;
    await q('DELETE FROM skills WHERE modulo = $1 AND origem = $2', [modulo, 'gerada']);
    const linha = await um<{ id: string }>(
      `INSERT INTO skills (nome, descricao, quando_usar, instrucoes, origem, modulo, gerada_por, revisada)
       VALUES ($1,$2,$3,$4,'gerada',$5,$6,false)
       ON CONFLICT (nome) DO UPDATE SET descricao=EXCLUDED.descricao, quando_usar=EXCLUDED.quando_usar,
         instrucoes=EXCLUDED.instrucoes, modulo=EXCLUDED.modulo, origem='gerada',
         gerada_por=EXCLUDED.gerada_por, revisada=false, atualizado=now()
       RETURNING id`,
      [
        nome,
        String(s?.descricao ?? '').slice(0, 500),
        String(s?.quando_usar ?? '').slice(0, 500),
        instrucoes.slice(0, 20_000),
        modulo,
        `${r.provedor}/${r.modelo}`,
      ],
    );
    return { ok: true, skillId: linha!.id, nome };
  } catch (e: any) {
    return { ok: false, erro: String(e?.message ?? e).slice(0, 300) };
  }
}

/** Aplica a skill do módulo às respostas de exemplo e guarda a rodada. */
export async function gerarExemplo(
  modulo: number,
): Promise<{ ok: boolean; erro?: string; rodada?: number }> {
  const rs = await respostasExemplo(modulo);
  if (!rs.length) return { ok: false, erro: 'Responda pelo menos uma pergunta de entrada antes de gerar.' };
  const skill = await um<{ id: string; nome: string; descricao: string; quando_usar: string; instrucoes: string }>(
    "SELECT id, nome, descricao, quando_usar, instrucoes FROM skills WHERE modulo = $1 AND origem = 'gerada' ORDER BY atualizado DESC LIMIT 1",
    [modulo],
  );
  if (!skill) return { ok: false, erro: 'A skill do módulo ainda não foi gerada.' };

  const respostas = rs.map((r) => `${r.rotulo}\n${r.valor}`).join('\n\n');
  const sistema = await sistemaComPerfil();
  const estrutura = await textoPrompt(`modulo-${modulo}`);

  const ant = await q<{ modulo: number; conteudo: any }>(
    `SELECT modulo, conteudo FROM exemplo_saidas WHERE modulo < $1 AND estado = 'pronto' ORDER BY modulo DESC`,
    [modulo],
  );
  let anterior = '';
  for (const a of ant) {
    const bloco = `\n### Módulo ${a.modulo} (exemplo)\n${JSON.stringify(a.conteudo, null, 1)}\n`;
    if (anterior.length + bloco.length > 9000) break;
    anterior = bloco + anterior;
  }

  const numeros = modulo === 4 ? calcularNumeros4(rs) : '';
  const usuario = [
    `## Skill do módulo (siga à risca)\n${skill.instrucoes}`,
    anterior ? `## O que já foi construído neste exemplo\n${anterior}` : '',
    numeros,
    `## Respostas dela neste módulo\n${respostas}`,
    `## Estrutura da saída\n${estrutura}`,
    'Devolva apenas o JSON pedido, sem texto antes nem depois, sem cercas de código.',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const cfg = await configIA();
    let r: any = null;
    let veredito: any = null;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      r = await gerar({ sistema, usuario, maxTokens: 3000 }, cfg);
      veredito = avaliar(r.texto, tentativa);
      if (veredito.acao !== 'regerar') break;
    }

    if (veredito?.acao === 'bloquear') {
      const erro = `BLOQUEADO: ${veredito.clinico.map((c: any) => c.motivo).join('; ')}`;
      await q(
        `INSERT INTO exemplo_saidas (modulo, estado, erro, provedor, modelo, custo_centavos, gerado_em)
         VALUES ($1,'bloqueado',$2,$3,$4,$5,now())
         ON CONFLICT (modulo) DO UPDATE SET estado='bloqueado', conteudo=NULL, erro=$2, provedor=$3,
           modelo=$4, custo_centavos=$5, gerado_em=now()`,
        [modulo, erro, r.provedor, r.modelo, r.custoCentavos],
      );
      return { ok: false, erro };
    }

    const saida = parseSaida(r.texto);
    await q(
      `INSERT INTO exemplo_saidas (modulo, estado, conteudo, erro, provedor, modelo, custo_centavos, gerado_em)
       VALUES ($1,'pronto',$2,NULL,$3,$4,$5,now())
       ON CONFLICT (modulo) DO UPDATE SET estado='pronto', conteudo=$2, erro=NULL, provedor=$3,
         modelo=$4, custo_centavos=$5, gerado_em=now()`,
      [modulo, JSON.stringify(saida), r.provedor, r.modelo, r.custoCentavos],
    );
    const est = await um<{ rodada: number }>(
      `INSERT INTO modulo_estado (modulo, rodada) VALUES ($1, 1)
       ON CONFLICT (modulo) DO UPDATE SET rodada = modulo_estado.rodada + 1 RETURNING rodada`,
      [modulo],
    );
    await q(
      `INSERT INTO rodadas (modulo, rodada, skill, saida, provedor, modelo, custo_centavos)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [modulo, est!.rodada, JSON.stringify(skill), JSON.stringify(saida), r.provedor, r.modelo, r.custoCentavos],
    );
    return { ok: true, rodada: est!.rodada };
  } catch (e: any) {
    return { ok: false, erro: String(e?.message ?? e).slice(0, 300) };
  }
}
