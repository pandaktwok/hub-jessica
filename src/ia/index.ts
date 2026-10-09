// Camada de modelo. Quatro provedores com a mesma interface, mais um modo de
// simulação para desenvolver e testar sem gastar API.
//
// A estrutura dos prompts é fixa; só muda o direcionamento para o modelo escolhido.

import { lerConfig, um } from '../db.ts';
import { decifrar } from '../cofre.ts';

export type Provedor = 'claude' | 'openai' | 'gemini' | 'meta' | 'stub';

export interface Pedido {
  sistema: string;
  usuario: string;
  maxTokens?: number;
}

export interface Resposta {
  texto: string;
  tokensIn: number;
  tokensOut: number;
  custoCentavos: number;
  provedor: Provedor;
  modelo: string;
}

/** Preço por milhão de tokens, em dólar. Conferido nas páginas oficiais em 2026-10-09. */
export const TABELA_PRECO: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
  'claude-opus-5': { in: 5, out: 25 },
  'gpt-5.6-luna': { in: 0.2, out: 1.2 },
  'gpt-5.6-terra': { in: 2, out: 12 },
  'gemini-3.5-flash-lite': { in: 0.3, out: 2.5 },
  'gemini-3.8-flash': { in: 0.75, out: 3.75 },
  'llama-maverick': { in: 0.2, out: 0.6 },
};

/** Modelos que a tela oferece. Os nomes são os da API; o que não estiver aqui pode ser digitado. */
export const MODELOS: { provedor: Provedor; id: string; nome: string }[] = [
  { provedor: 'claude', id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5' },
  { provedor: 'claude', id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5' },
  { provedor: 'claude', id: 'claude-opus-5-5', nome: 'Claude Opus 5.5' },
  { provedor: 'gemini', id: 'gemini-3.8-flash', nome: 'Gemini 3.8 Flash' },
  { provedor: 'gemini', id: 'gemini-3.5-flash-lite', nome: 'Gemini 3.5 Flash-Lite' },
  { provedor: 'openai', id: 'gpt-5.6-terra', nome: 'GPT 5.6 Terra' },
  { provedor: 'openai', id: 'gpt-5.6-luna', nome: 'GPT 5.6 Luna' },
];

export const MODELO_PADRAO: Record<Provedor, string> = {
  claude: 'claude-sonnet-5-5',
  openai: 'gpt-5.6-terra',
  gemini: 'gemini-3.8-flash',
  meta: 'llama-maverick',
  stub: 'stub',
};

function custo(modelo: string, tIn: number, tOut: number): number {
  const p = TABELA_PRECO[modelo];
  if (!p) return 0;
  const dolares = (tIn / 1e6) * p.in + (tOut / 1e6) * p.out;
  return Math.round(dolares * 100 * 100) / 100; // centavos de dólar, 2 casas
}

async function postJson(url: string, headers: Record<string, string>, corpo: unknown) {
  const ctrl = new AbortController();
  const limite = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    const texto = await r.text();
    if (!r.ok) {
      // Mensagem legível por quem instalou, não rastro de pilha.
      const curta = texto.slice(0, 400);
      if (r.status === 401 || r.status === 403) {
        throw new Error(`CHAVE_RECUSADA: o provedor recusou a chave (HTTP ${r.status}). ${curta}`);
      }
      if (r.status === 429) throw new Error(`LIMITE: o provedor pediu para esperar. ${curta}`);
      throw new Error(`PROVEDOR_${r.status}: ${curta}`);
    }
    return JSON.parse(texto);
  } finally {
    clearTimeout(limite);
  }
}

// ------------------------------------------------------------------ adaptadores

async function viaClaude(p: Pedido, chave: string, modelo: string): Promise<Resposta> {
  const d = await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
    {
      model: modelo,
      max_tokens: p.maxTokens ?? 4096,
      system: p.sistema,
      messages: [{ role: 'user', content: p.usuario }],
    },
  );
  const tIn = d.usage?.input_tokens ?? 0;
  const tOut = d.usage?.output_tokens ?? 0;
  return {
    texto: (d.content ?? []).map((b: any) => b.text ?? '').join(''),
    tokensIn: tIn,
    tokensOut: tOut,
    custoCentavos: custo(modelo, tIn, tOut),
    provedor: 'claude',
    modelo,
  };
}

async function viaOpenAI(p: Pedido, chave: string, modelo: string): Promise<Resposta> {
  const d = await postJson(
    'https://api.openai.com/v1/chat/completions',
    { authorization: `Bearer ${chave}` },
    {
      model: modelo,
      max_completion_tokens: p.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: p.sistema },
        { role: 'user', content: p.usuario },
      ],
    },
  );
  const tIn = d.usage?.prompt_tokens ?? 0;
  const tOut = d.usage?.completion_tokens ?? 0;
  return {
    texto: d.choices?.[0]?.message?.content ?? '',
    tokensIn: tIn,
    tokensOut: tOut,
    custoCentavos: custo(modelo, tIn, tOut),
    provedor: 'openai',
    modelo,
  };
}

async function viaGemini(p: Pedido, chave: string, modelo: string): Promise<Resposta> {
  const d = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    { 'x-goog-api-key': chave },
    {
      systemInstruction: { parts: [{ text: p.sistema }] },
      contents: [{ role: 'user', parts: [{ text: p.usuario }] }],
      generationConfig: { maxOutputTokens: p.maxTokens ?? 4096 },
    },
  );
  const tIn = d.usageMetadata?.promptTokenCount ?? 0;
  const tOut = d.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    texto: (d.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? '').join(''),
    tokensIn: tIn,
    tokensOut: tOut,
    custoCentavos: custo(modelo, tIn, tOut),
    provedor: 'gemini',
    modelo,
  };
}

// A Meta não publica uma API geral própria nos mesmos moldes das outras três; os
// modelos Llama costumam ser alcançados por um intermediário compatível com o
// formato da OpenAI (Groq, Together, Bedrock). Por isso o endereço é configurável.
// CONFIRMAR antes de prometer este provedor para a cliente.
async function viaMeta(p: Pedido, chave: string, modelo: string, base?: string): Promise<Resposta> {
  const url = `${(base ?? 'https://api.groq.com/openai/v1').replace(/\/$/, '')}/chat/completions`;
  const d = await postJson(
    url,
    { authorization: `Bearer ${chave}` },
    {
      model: modelo,
      max_tokens: p.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: p.sistema },
        { role: 'user', content: p.usuario },
      ],
    },
  );
  const tIn = d.usage?.prompt_tokens ?? 0;
  const tOut = d.usage?.completion_tokens ?? 0;
  return {
    texto: d.choices?.[0]?.message?.content ?? '',
    tokensIn: tIn,
    tokensOut: tOut,
    custoCentavos: custo(modelo, tIn, tOut),
    provedor: 'meta',
    modelo,
  };
}

function viaStub(p: Pedido): Resposta {
  // Determinística de propósito: teste ponta a ponta sem gastar e sem variar.
  const eco = p.usuario.slice(0, 160).replace(/\s+/g, ' ');
  if (p.usuario.includes('SKILL_DO_MODULO')) {
    return {
      texto: JSON.stringify({
        nome: 'escrita-simulada',
        descricao: 'Skill simulada do módulo.',
        quando_usar: 'Ao gerar o texto deste módulo.',
        instrucoes: '1. Leia as respostas.\n2. Escreva na voz da mentora.\n3. Devolva o JSON pedido.',
      }),
      tokensIn: 100, tokensOut: 80, custoCentavos: 0, provedor: 'stub', modelo: 'stub',
    };
  }
  if (p.usuario.includes('Extraia de 2 a 5 procedimentos')) {
    return {
      texto: JSON.stringify({
        skills: [
          { nome: 'procedimento-simulado-um', descricao: 'Skill simulada.', quando_usar: 'Ao testar o fluxo.', instrucoes: '1. Primeiro passo simulado.\n2. Segundo passo simulado.' },
          { nome: 'procedimento-simulado-dois', descricao: 'Outra skill simulada.', quando_usar: 'Ao testar o fluxo.', instrucoes: '1. Passo simulado.' },
        ],
      }),
      tokensIn: 100, tokensOut: 80, custoCentavos: 0, provedor: 'stub', modelo: 'stub',
    };
  }
  return {
    texto: JSON.stringify({
      simulado: true,
      resumo: `Resposta simulada. Entrada recebida: ${eco}`,
      proximos_3_passos: ['Primeiro passo simulado', 'Segundo passo', 'Terceiro passo'],
    }),
    tokensIn: Math.ceil(p.usuario.length / 4),
    tokensOut: 80,
    custoCentavos: 0,
    provedor: 'stub',
    modelo: 'stub',
  };
}

// ------------------------------------------------------------------ fachada

export interface ConfigIA {
  provedor: Provedor;
  modelo?: string;
  base?: string;
}

export function chaveDoAmbiente(provedor: Provedor): string | undefined {
  const mapa: Record<Provedor, string | undefined> = {
    claude: process.env.CLAUDE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    meta: process.env.META_API_KEY,
    stub: 'stub',
  };
  return mapa[provedor];
}

/** Chave do provedor: a cadastrada na tela (cifrada no banco) ou, na falta, a do .env. */
export async function chaveDaConta(provedor: Provedor): Promise<string | undefined> {
  if (provedor === 'stub') return 'stub';
  const l = await um<{ cifrada: Buffer; iv: Buffer; tag: Buffer }>(
    'SELECT cifrada, iv, tag FROM chaves_ia WHERE provedor = $1',
    [provedor],
  );
  if (l) return decifrar(l);
  return chaveDoAmbiente(provedor);
}

// A conexão salva na tela vale primeiro. O modo de simulação (LLM_MODE=stub) só vale
// enquanto ninguém conectou uma IA: antes, ele ignorava a conexão salva e o programa
// continuava simulando mesmo com a chave cadastrada.
export async function configIA(): Promise<ConfigIA> {
  const salva = await lerConfig<ConfigIA>('ia');
  if (salva?.provedor && salva.provedor !== 'stub') return salva;
  return { provedor: 'stub', modelo: 'stub' };
}

export async function gerar(p: Pedido, cfg?: ConfigIA, chaveOverride?: string): Promise<Resposta> {
  const c = cfg ?? (await configIA());
  const provedor = c.provedor;
  const modelo = c.modelo || MODELO_PADRAO[provedor];

  if (provedor === 'stub') return viaStub(p);

  const chave = chaveOverride ?? (await chaveDaConta(provedor));
  if (!chave) {
    throw new Error(
      `CHAVE_AUSENTE: não há chave configurada para ${provedor}. ` +
        `Cadastre a chave em "Conecte a sua IA".`,
    );
  }

  switch (provedor) {
    case 'claude':
      return viaClaude(p, chave, modelo);
    case 'openai':
      return viaOpenAI(p, chave, modelo);
    case 'gemini':
      return viaGemini(p, chave, modelo);
    case 'meta':
      return viaMeta(p, chave, modelo, c.base);
  }
}

/** Chamada curta só para dizer na tela se a conexão funciona. */
export async function testar(cfg: ConfigIA, chave?: string): Promise<{ ok: boolean; detalhe: string }> {
  try {
    const r = await gerar(
      { sistema: 'Responda em uma linha.', usuario: 'Diga: conexão funcionando.', maxTokens: 64 },
      cfg,
      chave,
    );
    return { ok: true, detalhe: r.texto.trim().slice(0, 200) };
  } catch (e: any) {
    const m = String(e.message ?? e);
    if (m.startsWith('CHAVE_RECUSADA') || m.startsWith('CHAVE_AUSENTE')) {
      return { ok: false, detalhe: 'A chave não está sendo aceita. Confira a chave e tente de novo.' };
    }
    if (m.startsWith('LIMITE')) {
      return { ok: false, detalhe: 'O provedor pediu para esperar. Tente de novo em instantes.' };
    }
    return { ok: false, detalhe: m.slice(0, 300) };
  }
}
