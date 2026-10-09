// Anonimização de material clínico, aplicada NA ENTRADA.
//
// Quando a mentora sobe o PDF de uma consulta que ela já fez, o que interessa para
// gerar as skills é o método dela, não quem foi atendido. O texto original não é
// guardado em lugar nenhum: o que vai para o banco já vem limpo daqui.
//
// Isto reduz risco, não o elimina. Texto corrido pode conter identificação que nenhuma
// regra pega. Por isso a tela avisa a mentora antes de ela subir, e por isso o material
// nunca é mostrado para a mentorada, só usado para gerar skills.

export interface Resultado {
  texto: string;
  removidos: Record<string, number>;
  total: number;
}

type Regra = { nome: string; padrao: RegExp; troca: string };

const REGRAS: Regra[] = [
  // Identificadores estruturados: pegam bem porque têm forma fixa.
  { nome: 'CPF', padrao: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, troca: '[CPF]' },
  { nome: 'CNS', padrao: /\b\d{3}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, troca: '[CARTÃO SUS]' },
  { nome: 'RG', padrao: /\b(?:RG|identidade)[:\s]*[\d.\-\/]{5,20}\b/gi, troca: '[RG]' },
  { nome: 'e-mail', padrao: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, troca: '[E-MAIL]' },
  {
    nome: 'telefone',
    padrao: /(?:\+55\s?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g,
    troca: '[TELEFONE]',
  },
  { nome: 'CEP', padrao: /\b\d{5}-?\d{3}\b/g, troca: '[CEP]' },
  {
    nome: 'data',
    padrao: /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g,
    troca: '[DATA]',
  },
  // Campos rotulados: "Paciente: Fulana de Tal", "Nome: ...", "Responsável: ..."
  {
    nome: 'nome em campo',
    padrao:
      /\b(paciente|nome(?:\s+completo)?|responsável|responsavel|acompanhante|mãe|mae|pai|médic[oa]\s+solicitante)\s*:\s*[^\n,;]{2,60}/gi,
    troca: '$1: [NOME]',
  },
  // Endereço em campo rotulado.
  {
    nome: 'endereço',
    padrao: /\b(endereço|endereco|rua|avenida|av\.)\s*:?\s*[^\n]{5,80}/gi,
    troca: '[ENDEREÇO]',
  },
  // Prontuário / matrícula / registro numérico.
  {
    nome: 'prontuário',
    padrao: /\b(prontuário|prontuario|matrícula|matricula|registro|atendimento)\s*(n[ºo°.]?\s*)?[:\s]*\d{3,}/gi,
    troca: '[PRONTUÁRIO]',
  },
];

/**
 * Nomes próprios soltos no texto corrido: duas ou mais palavras capitalizadas seguidas,
 * ignorando início de frase e palavras comuns. Heurística deliberadamente conservadora,
 * porque apagar demais estraga o material e apagar de menos é pior.
 */
const CONECTIVOS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
const COMUNS = new Set([
  'Hospital', 'Clínica', 'Clinica', 'Consultório', 'Consultorio', 'Unidade', 'Centro',
  'Instituto', 'Universidade', 'Faculdade', 'Ministério', 'Ministerio', 'Secretaria',
  'Protocolo', 'Exame', 'Resultado', 'Diagnóstico', 'Diagnostico', 'Queixa', 'História',
  'Historia', 'Conduta', 'Plano', 'Evolução', 'Evolucao', 'Observação', 'Observacao',
  'Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo',
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Dra', 'Dr', 'Sra', 'Sr',
]);

function nomesProprios(texto: string): { texto: string; n: number } {
  let n = 0;
  const saida = texto.replace(
    /\b[A-ZÀ-Ý][a-zà-ÿ]{1,}(?:\s+(?:de|da|do|dos|das|e|[A-ZÀ-Ý][a-zà-ÿ]{1,})){1,4}\b/g,
    (m) => {
      const palavras = m.split(/\s+/);
      const maiusculas = palavras.filter((p) => !CONECTIVOS.has(p.toLowerCase()));
      if (maiusculas.length < 2) return m;
      if (maiusculas.some((p) => COMUNS.has(p))) return m;
      // Sequência de nomes próprios sem termo comum no meio: trata como nome de pessoa.
      n++;
      return '[NOME]';
    },
  );
  return { texto: saida, n };
}

export function anonimizar(bruto: string): Resultado {
  let texto = bruto;
  const removidos: Record<string, number> = {};

  for (const { nome, padrao, troca } of REGRAS) {
    padrao.lastIndex = 0;
    const achados = texto.match(padrao);
    if (achados?.length) {
      removidos[nome] = (removidos[nome] ?? 0) + achados.length;
      texto = texto.replace(padrao, troca);
    }
  }

  const { texto: semNomes, n } = nomesProprios(texto);
  if (n) removidos['nome próprio'] = n;

  const total = Object.values(removidos).reduce((a, b) => a + b, 0);
  return { texto: semNomes, removidos, total };
}

/** Texto de um PDF. Devolve vazio se o PDF for só imagem digitalizada. */
export async function textoDoPdf(buf: Buffer): Promise<string> {
  const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
  const d = await pdfParse(buf);
  return (d.text ?? '').trim();
}
