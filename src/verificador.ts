// Duas verificações com políticas OPOSTAS. Isto não é detalhe de implementação:
//
//   Glossário  -> lista fechada, mecânica. Achou e insistiu: MOSTRA e registra.
//                 Esconder seria pior que mostrar um texto que ela pode editar.
//   Clínico    -> classe aberta, semântica. Achou e insistiu: BLOQUEIA, não exibe,
//                 avisa a mentora. O PDF diz "nunca", e "nunca" não admite degradação.
//
// Não junte as duas numa função só com uma política só.

export interface AchadoGlossario {
  proibida: string;
  sugerida: string;
  trecho: string;
}

/** Decisão travada: estas quatro não aparecem em saída de IA nem em texto da interface. */
const GLOSSARIO: { padrao: RegExp; proibida: string; sugerida: string }[] = [
  { padrao: /\bvenda(s|r|ndo)?\b/gi, proibida: 'vendas', sugerida: 'crescimento ou atendimento' },
  { padrao: /\bcomercial(is|mente)?\b/gi, proibida: 'comercial', sugerida: 'posicionamento' },
  { padrao: /\bplanos?\s+de\s+sa[úu]de\b/gi, proibida: 'plano de saúde', sugerida: 'serviços de saúde' },
  { padrao: /\bmentoria\s+em\s+grupo\b/gi, proibida: 'mentoria em grupo', sugerida: 'acompanhamento' },
];

export function verificarGlossario(texto: string): AchadoGlossario[] {
  const achados: AchadoGlossario[] = [];
  for (const { padrao, proibida, sugerida } of GLOSSARIO) {
    padrao.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = padrao.exec(texto)) !== null) {
      const ini = Math.max(0, m.index - 40);
      achados.push({
        proibida,
        sugerida,
        trecho: texto.slice(ini, Math.min(texto.length, m.index + m[0].length + 40)),
      });
      if (achados.length > 50) return achados;
    }
  }
  return achados;
}

// ---------------------------------------------------------------- clínico

export interface AchadoClinico {
  motivo: string;
  trecho: string;
}

// Detecção por classe aberta nunca é completa. Por isso a POLÍTICA é bloquear:
// a garantia vem de não exibir, não de a lista estar certa.
const SINAIS_CLINICOS: { padrao: RegExp; motivo: string }[] = [
  { padrao: /\b(prescre[vb]\w*|receit\w+|posologi\w+|dosagem|dose de)\b/gi, motivo: 'prescrição ou dosagem' },
  { padrao: /\b(mg|ml|mcg|UI)\s*(por|\/)\s*(dia|kg|dose)\b/gi, motivo: 'posologia' },
  { padrao: /\b(protocolo|conduta|manejo)\s+(cl[íi]nic\w+|terap[êe]utic\w+|de\s+tratamento)\b/gi, motivo: 'protocolo ou conduta clínica' },
  { padrao: /\b(diagn[óo]stic\w+\s+(de|diferencial)|quadro\s+cl[íi]nico\s+de)\b/gi, motivo: 'diagnóstico de saúde' },
  { padrao: /\b(indic\w+|recomend\w+|sugir\w+|suger\w+)\s+(o\s+)?(uso|tratamento|procedimento|medicament\w+|f[áa]rmac\w+)\b/gi, motivo: 'recomendação de tratamento' },
  { padrao: /\b(contraindica\w+|efeitos?\s+adversos?|intera[çc][ãa]o\s+medicamentosa)\b/gi, motivo: 'orientação farmacológica' },
  { padrao: /\b(voc[êe]\s+deve|recomendo\s+que|o\s+ideal\s+[ée])\s+\w*\s*(aplicar|administrar|injetar|operar|medicar)\b/gi, motivo: 'conduta dirigida' },
];

export function verificarClinico(texto: string): AchadoClinico[] {
  const achados: AchadoClinico[] = [];
  for (const { padrao, motivo } of SINAIS_CLINICOS) {
    padrao.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = padrao.exec(texto)) !== null) {
      const ini = Math.max(0, m.index - 60);
      achados.push({
        motivo,
        trecho: texto.slice(ini, Math.min(texto.length, m.index + m[0].length + 60)),
      });
      if (achados.length > 20) return achados;
    }
  }
  return achados;
}

export type Veredito =
  | { acao: 'exibir'; glossario: AchadoGlossario[] }
  | { acao: 'regerar'; motivo: string }
  | { acao: 'bloquear'; clinico: AchadoClinico[] };

/**
 * @param tentativa 1 na primeira geração, 2 depois de já ter regerado uma vez.
 */
export function avaliar(texto: string, tentativa: number): Veredito {
  const clinico = verificarClinico(texto);
  const glossario = verificarGlossario(texto);

  if (clinico.length > 0) {
    // Clínico sempre tenta de novo uma vez; insistindo, bloqueia. Nunca exibe.
    return tentativa === 1
      ? { acao: 'regerar', motivo: `conteúdo clínico: ${clinico[0].motivo}` }
      : { acao: 'bloquear', clinico };
  }
  if (glossario.length > 0 && tentativa === 1) {
    return { acao: 'regerar', motivo: `palavra proibida: ${glossario[0].proibida}` };
  }
  // Glossário que insistiu: exibe marcado, ela pode editar, e fica registrado.
  return { acao: 'exibir', glossario };
}
