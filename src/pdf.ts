import PDFDocument from 'pdfkit';

// PDF de exemplo de um módulo: o que a mentora respondeu e o que a IA gerou a partir
// disso. Fontes embutidas do PDF (Helvetica) cobrem os acentos do português.

function rotulo(chave: string): string {
  const t = chave.replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Escritor = (texto: string, opcoes?: { negrito?: boolean; tamanho?: number; recuo?: number; cinza?: boolean }) => void;

function escreverValor(w: Escritor, v: unknown, nivel: number): void {
  if (v == null || v === '') return;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    w(String(v), { recuo: nivel * 14 });
    return;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      if (item && typeof item === 'object') {
        escreverValor(w, item, nivel + 1);
        w(' ', { tamanho: 4 });
      } else {
        w(`•  ${String(item)}`, { recuo: nivel * 14 });
      }
    }
    return;
  }
  if (typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val == null || val === '') continue;
      w(rotulo(k), { negrito: true, tamanho: 10.5, recuo: nivel * 14 });
      escreverValor(w, val, nivel + 1);
    }
  }
}

export function pdfExemplo(o: {
  modulo: number;
  titulo: string;
  mentora: string;
  respostas: { rotulo: string; valor: string }[];
  saida: unknown;
  provedor?: string | null;
  modelo?: string | null;
  rodada?: number;
  observacoes?: string[];
  rodape?: string;
}): Promise<Buffer> {
  return new Promise((ok, no) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: 64, right: 64 }, info: { Title: `Módulo ${o.modulo} — exemplo` } });
    const partes: Buffer[] = [];
    doc.on('data', (b: Buffer) => partes.push(b));
    doc.on('end', () => ok(Buffer.concat(partes)));
    doc.on('error', no);

    const w: Escritor = (texto, op = {}) => {
      doc
        .font(op.negrito ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(op.tamanho ?? 11)
        .fillColor(op.cinza ? '#666666' : '#111111')
        .text(texto, 64 + (op.recuo ?? 0), undefined, { width: 467 - (op.recuo ?? 0), lineGap: 3 });
      doc.moveDown(0.35);
    };

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#666666')
      .text(`EXEMPLO PARA REVISÃO${o.rodada ? ' · VERSÃO ' + o.rodada : ''}`, { characterSpacing: 2 });
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#111111')
      .text(`Módulo ${o.modulo}`, { lineGap: 0 });
    doc.font('Helvetica-Bold').fontSize(24).text(o.titulo, { lineGap: 2 });
    doc.moveDown(0.4);
    w(
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} para ${o.mentora}${
        o.provedor ? ` · ${o.provedor}${o.modelo ? ` / ${o.modelo}` : ''}` : ''
      }`,
      { cinza: true, tamanho: 9.5 },
    );

    doc.moveDown(0.8);
    doc.moveTo(64, doc.y).lineTo(531, doc.y).strokeColor('#111111').lineWidth(1.2).stroke();
    doc.moveDown(0.9);

    w('O QUE FOI RESPONDIDO (EXEMPLO DE PREENCHIMENTO)', { negrito: true, tamanho: 9 });
    for (const r of o.respostas) {
      w(r.rotulo, { negrito: true, tamanho: 10.5 });
      w(r.valor, { recuo: 10 });
    }

    doc.moveDown(0.8);
    doc.moveTo(64, doc.y).lineTo(531, doc.y).strokeColor('#D0CCC4').lineWidth(0.8).stroke();
    doc.moveDown(0.9);

    w('O QUE A IA GERARIA PARA A MENTORADA', { negrito: true, tamanho: 9 });
    escreverValor(w, o.saida, 0);

    if (o.observacoes?.length) {
      doc.moveDown(0.8);
      w('SUAS OBSERVAÇÕES ATÉ AQUI (JÁ CONSIDERADAS NESTA VERSÃO)', { negrito: true, tamanho: 9 });
      o.observacoes.forEach((t, i) => w(`${i + 1}. ${t.slice(0, 1500)}`, { recuo: 10 }));
    }

    if (o.rodape) {
      if (doc.y > 720) doc.addPage();
      doc.moveDown(1.2);
      const topo = doc.y;
      const alt = 46;
      doc.rect(64, topo, 467, alt).fill('#F59E42');
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1D1305')
        .text(o.rodape, 76, topo + 9, { width: 443, lineGap: 2 });
    }

    doc.end();
  });
}
