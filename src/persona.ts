// A voz do assistente, montada a partir das escolhas da mentora no perfil.
// Sem inteligência artificial no meio: são opções marcadas e um texto dela, então o
// resultado é previsível, grátis e igual toda vez.

export const TONS: { id: string; rotulo: string; instrucao: string }[] = [
  { id: 'formal', rotulo: 'Formal', instrucao: 'Escreva com formalidade: sem gíria, sem diminutivo, sem emoji.' },
  { id: 'acolhedor', rotulo: 'Acolhedor', instrucao: 'Reconheça o que a pessoa disse antes de orientar. Acolher vem antes de propor.' },
  { id: 'direto', rotulo: 'Preciso e direto', instrucao: 'Uma ideia por frase. Sem rodeio e sem adjetivo que não informe nada.' },
  { id: 'curto', rotulo: 'Palavras curtas', instrucao: 'Prefira palavras curtas e do dia a dia a termo rebuscado.' },
  { id: 'didatico', rotulo: 'Didático', instrucao: 'Explique em uma frase o porquê de cada sugestão.' },
  { id: 'inspirador', rotulo: 'Inspirador', instrucao: 'Mostre o que é possível, sem prometer resultado.' },
];

export const PESSOAS = [
  { id: 'primeira', rotulo: 'Primeira pessoa (“eu ajudo você”)', instrucao: 'O assistente fala de si na primeira pessoa: “eu”.' },
  { id: 'neutra', rotulo: 'Sem se incluir (“vamos organizar”)', instrucao: 'O assistente não fala de si; usa verbos no coletivo ou no imperativo.' },
];

export const TRATAMENTOS = [
  { id: 'voce', rotulo: 'Você', instrucao: 'Trate a mentorada por “você”.' },
  { id: 'doutora', rotulo: 'Doutora', instrucao: 'Trate a mentorada por “doutora” seguido do nome, quando o nome estiver disponível.' },
  { id: 'senhora', rotulo: 'A senhora', instrucao: 'Trate a mentorada por “a senhora”.' },
];

export interface Perfil {
  nome?: string;
  marca?: string;
  apresentacao?: string;
  pessoa?: string;
  tratamento?: string;
  tom?: string[];
  observacoes?: string;
  exemplo_escrita?: string;
}

/** Bloco de instruções de estilo, anexado ao texto de sistema de toda geração. */
export function blocoEstilo(p: Perfil): string {
  const linhas: string[] = [];
  const pessoa = PESSOAS.find((x) => x.id === p.pessoa);
  const trat = TRATAMENTOS.find((x) => x.id === p.tratamento);
  if (pessoa) linhas.push(pessoa.instrucao);
  if (trat) linhas.push(trat.instrucao);
  for (const id of p.tom ?? []) {
    const t = TONS.find((x) => x.id === id);
    if (t) linhas.push(t.instrucao);
  }
  if (p.observacoes?.trim()) linhas.push(`Observações da mentora sobre a escrita: ${p.observacoes.trim()}`);
  if (!linhas.length && !p.exemplo_escrita?.trim()) return '';
  const exemplo = p.exemplo_escrita?.trim()
    ? `\n\nExemplo de como a mentora escreve (imite o ritmo e o vocabulário, não copie o conteúdo):\n"""\n${p.exemplo_escrita.trim().slice(0, 3000)}\n"""`
    : '';
  return `COMO ESCREVER\n${linhas.map((l) => `- ${l}`).join('\n')}${exemplo}`;
}

/** A skill de persona: o que o assistente é e como fala. Vira arquivo .md. */
export function skillPersona(p: Perfil): { nome: string; descricao: string; quando_usar: string; instrucoes: string } {
  const estilo = blocoEstilo(p);
  const apresentacao = p.apresentacao?.trim();
  return {
    nome: 'persona-assistente',
    descricao: `Voz e apresentação do assistente${p.marca ? ` da ${p.marca}` : ''}.`,
    quando_usar: 'Em toda resposta que o assistente escrever para uma mentorada, em qualquer módulo.',
    instrucoes: [
      apresentacao ? `Apresentação do assistente:\n${apresentacao}` : '',
      estilo || 'A mentora ainda não definiu o estilo de escrita.',
      'Limites que não mudam: nunca sugerir conduta clínica, procedimento, dosagem ou diagnóstico de saúde.',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

export function skillMd(s: {
  nome: string;
  descricao?: string | null;
  quando_usar?: string | null;
  instrucoes?: string | null;
}): string {
  const linha = (v?: string | null) => String(v ?? '').replace(/\s+/g, ' ').trim();
  return `---
name: ${s.nome}
description: ${linha(s.descricao)}${s.quando_usar ? ` Use quando: ${linha(s.quando_usar)}` : ''}
---

# ${s.nome}

${s.quando_usar ? `## Quando usar\n\n${s.quando_usar.trim()}\n\n` : ''}## Procedimento

${(s.instrucoes ?? '').trim()}
`;
}
