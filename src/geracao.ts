import { createHash } from 'node:crypto';
import { q, um, lerConfig } from './db.ts';
import { gerar, configIA } from './ia/index.ts';
import { avaliar } from './verificador.ts';

// Orçamento de contexto. Sem isto, no módulo 6 o prompt carrega cinco módulos de saída
// mais todas as respostas, e a geração estoura os 30 segundos justamente no módulo que
// a mentorada mais esperou. O corte é por tamanho, do mais antigo para o mais novo.
const TETO_CONTEXTO = 24_000; // caracteres, não tokens: mais barato de medir e conservador

export interface Modulo {
  numero: number;
  titulo: string;
}

export const MODULOS: Modulo[] = [
  { numero: 1, titulo: 'Persona' },
  { numero: 2, titulo: 'Diferenciais' },
  { numero: 3, titulo: 'Mensagem' },
  { numero: 4, titulo: 'Precificação' },
  { numero: 5, titulo: 'Protocolos e ofertas' },
  { numero: 6, titulo: 'Plano de ação' },
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
  return base.replaceAll('{{MENTORA}}', perfil.nome || 'sua mentora');
}

/** Material que a mentora subiu, recortado para caber no orçamento. */
async function materialDoModulo(modulo: number, teto: number): Promise<string> {
  const mats = await q<{ nome: string; conteudo: string | null }>(
    `SELECT nome, conteudo FROM materiais
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
  const v = (c: string) => {
    const n = Number(String(rs.find((r) => r.campo === c)?.valor ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const preco = v('cobra_hoje');
  const horas = v('horas_por_atendimento');
  const porMes = v('atendimentos_por_mes');
  const custoFixo = v('custo_fixo_mes');

  const valorHora = horas > 0 ? preco / horas : 0;
  const receita = preco * porMes;
  const horasMes = horas * porMes;
  const sobra = receita - custoFixo;
  const sobraHora = horasMes > 0 ? sobra / horasMes : 0;
  const precoEquilibrio = porMes > 0 ? custoFixo / porMes : 0;

  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return `NÚMEROS JÁ CALCULADOS (use exatamente estes, não refaça conta nenhuma):
- Preço atual por atendimento: ${brl(preco)}
- Horas por atendimento, com preparo e retorno: ${horas}
- Valor-hora atual: ${brl(valorHora)}
- Atendimentos por mês: ${porMes}
- Horas trabalhadas no mês nesse serviço: ${horasMes}
- Receita mensal desse serviço: ${brl(receita)}
- Custo fixo mensal: ${brl(custoFixo)}
- Sobra mensal depois do custo fixo: ${brl(sobra)}
- Sobra por hora trabalhada: ${brl(sobraHora)}
- Preço de equilíbrio (abaixo disso ela paga para trabalhar): ${brl(precoEquilibrio)}`;
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
