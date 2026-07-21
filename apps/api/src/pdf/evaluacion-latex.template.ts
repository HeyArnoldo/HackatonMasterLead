import { ContenidoEvaluacion, ItemEvaluacion, TipoItemEvaluacion } from '@app/contracts';
import { escapeLatex } from './latex.util';

/**
 * Renderiza de forma DETERMINISTA un `contenidoEvaluacionSchema` a un documento
 * LaTeX limpio (una evaluación/examen imprimible). Cada ítem muestra su
 * desempeño oficial evaluado (código real del CNEB). Todo texto se escapa.
 */

const TIPO_LABEL: Record<TipoItemEvaluacion, string> = {
  [TipoItemEvaluacion.OPCION_MULTIPLE]: 'Opción múltiple',
  [TipoItemEvaluacion.VERDADERO_FALSO]: 'Verdadero / Falso',
  [TipoItemEvaluacion.RESPUESTA_ABIERTA]: 'Respuesta abierta',
};

const PREAMBLE = [
  '\\documentclass[11pt,a4paper]{article}',
  '\\usepackage[T1]{fontenc}',
  '\\usepackage[utf8]{inputenc}',
  '\\usepackage[spanish,es-noquoting]{babel}',
  '\\usepackage[margin=2.2cm]{geometry}',
  '\\usepackage{enumitem}',
  '\\usepackage{parskip}',
  '\\setlength{\\parindent}{0pt}',
].join('\n');

function renderOpciones(item: ItemEvaluacion): string {
  if (item.opciones.length === 0) return '';
  const letras = 'abcdefghijklmnopqrstuvwxyz';
  const body = item.opciones
    .map((op, i) => `  \\item[${letras[i] ?? '-'})] ${escapeLatex(op)}`)
    .join('\n');
  return `\\begin{itemize}[leftmargin=2em]\n${body}\n\\end{itemize}`;
}

function renderItem(item: ItemEvaluacion, index: number): string {
  const parts: string[] = [];
  const puntaje = `\\hfill {\\small (${escapeLatex(item.puntaje)} pts.)}`;
  parts.push(
    `\\textbf{${index + 1}.} ${escapeLatex(item.enunciado)}${puntaje}\\\\` +
      `{\\footnotesize \\textit{${TIPO_LABEL[item.tipo] ?? escapeLatex(item.tipo)} \\textemdash{} desempeño [${escapeLatex(item.desempenoCodigo)}]}}`,
  );
  const opciones = renderOpciones(item);
  if (opciones) parts.push(opciones);
  if (item.tipo === TipoItemEvaluacion.RESPUESTA_ABIERTA) {
    parts.push('\\vspace{1.5em}\\hrule\\vspace{1em}\\hrule');
  }
  return parts.join('\n\n');
}

export function renderEvaluacionLatex(contenido: ContenidoEvaluacion): string {
  const body: string[] = [];
  body.push(PREAMBLE);
  body.push('\\begin{document}');

  body.push(
    `\\begin{center}\n{\\LARGE \\textbf{${escapeLatex(contenido.titulo)}}}\\\\[0.3em]\n{\\large Evaluación}\n\\end{center}\n\\vspace{0.3em}`,
  );

  const datos = [
    `\\textbf{Área:} ${escapeLatex(contenido.area)}`,
    `\\textbf{Grado:} ${escapeLatex(contenido.grado)}.\\textsuperscript{o}`,
    `\\textbf{Puntaje total:} ${escapeLatex(contenido.puntajeTotal)} pts.`,
  ];
  body.push(datos.join(' \\hfill '));
  body.push('\\vspace{0.3em}\\hrule\\vspace{0.6em}');

  body.push(`\\textbf{Instrucciones:} ${escapeLatex(contenido.instrucciones)}`);
  body.push('\\vspace{0.6em}');

  contenido.items.forEach((item, i) => {
    body.push(renderItem(item, i));
  });

  body.push('\\end{document}');
  return body.filter((b) => b.length > 0).join('\n\n');
}
