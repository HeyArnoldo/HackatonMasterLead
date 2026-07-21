import { ContenidoSesion, Momento, MomentoNombre } from '@app/contracts';
import { escapeLatex } from './latex.util';

/**
 * Renderiza de forma DETERMINISTA un `contenidoSesionSchema` a un documento
 * LaTeX limpio y profesional (la sesión de aprendizaje del CNEB). Es la ruta
 * PRIMARIA y confiable: dado un contenido válido, siempre produce un `.tex`
 * compilable. Todo texto de usuario/IA se escapa con `escapeLatex`.
 */

/** `itemize` seguro: devuelve '' si la lista está vacía (LaTeX no admite itemize vacío). */
function itemize(items: readonly string[]): string {
  const clean = items.map((i) => (i ?? '').toString()).filter((i) => i.trim().length > 0);
  if (clean.length === 0) return '';
  const body = clean.map((i) => `  \\item ${escapeLatex(i)}`).join('\n');
  return `\\begin{itemize}\n${body}\n\\end{itemize}`;
}

const MOMENTO_LABEL: Record<MomentoNombre, string> = {
  [MomentoNombre.INICIO]: 'Inicio',
  [MomentoNombre.DESARROLLO]: 'Desarrollo',
  [MomentoNombre.CIERRE]: 'Cierre',
};

function renderMomento(m: Momento): string {
  const parts: string[] = [];
  const label = MOMENTO_LABEL[m.nombre] ?? escapeLatex(m.nombre);
  const tiempo = m.tiempo ? ` \\hfill \\textit{(${escapeLatex(m.tiempo)})}` : '';
  parts.push(`\\subsection*{${label}${tiempo}}`);

  if (m.actividades.length > 0) {
    parts.push('\\textbf{Actividades:}');
    parts.push(itemize(m.actividades));
  }

  for (const ag of m.actividadesPorGrado) {
    if (ag.actividades.length === 0) continue;
    parts.push(`\\textbf{Grado ${escapeLatex(ag.grado)}:}`);
    parts.push(itemize(ag.actividades));
  }

  if (m.recursos.length > 0) {
    parts.push(`\\textbf{Recursos:} ${m.recursos.map((r) => escapeLatex(r)).join(', ')}`);
  }

  return parts.filter((p) => p.length > 0).join('\n\n');
}

function renderProposito(p: ContenidoSesion['propositosAprendizaje'][number]): string {
  const parts: string[] = [];
  parts.push(
    `\\textbf{Competencia ${escapeLatex(p.competenciaCodigo)}:} ${escapeLatex(p.competenciaNombre)}`,
  );
  if (p.capacidades.length > 0) {
    parts.push('\\textit{Capacidades:}');
    parts.push(itemize(p.capacidades));
  }
  parts.push('\\textit{Desempeños:}');
  const desempenos = p.desempenos.map(
    (d) =>
      `  \\item \\textbf{[${escapeLatex(d.codigo)}]} ${escapeLatex(d.descripcion)} \\hfill {\\small (${escapeLatex(d.grado)}.\\textsuperscript{o} grado)}`,
  );
  parts.push(`\\begin{itemize}\n${desempenos.join('\n')}\n\\end{itemize}`);
  parts.push(`\\textit{Evidencia:} ${escapeLatex(p.evidencia)}`);
  return parts.filter((p) => p.length > 0).join('\n\n');
}

/** Preámbulo LaTeX autocontenido (paquetes base incluidos en Tectonic). */
const PREAMBLE = [
  '\\documentclass[11pt,a4paper]{article}',
  '\\usepackage[T1]{fontenc}',
  '\\usepackage[utf8]{inputenc}',
  '\\usepackage[spanish,es-noquoting]{babel}',
  '\\usepackage[margin=2.2cm]{geometry}',
  '\\usepackage{enumitem}',
  '\\usepackage{parskip}',
  '\\usepackage{titlesec}',
  '\\setlist{nosep,leftmargin=1.4em}',
  '\\setlength{\\parindent}{0pt}',
].join('\n');

export function renderSesionLatex(contenido: ContenidoSesion): string {
  const d = contenido.datosInformativos;
  const grados = d.grados.join(', ');
  const multigrado = d.grados.length > 1 ? ' (aula multigrado)' : '';

  const body: string[] = [];
  body.push(PREAMBLE);
  body.push('\\begin{document}');

  // Título.
  body.push(
    `\\begin{center}\n{\\LARGE \\textbf{${escapeLatex(contenido.titulo)}}}\\\\[0.3em]\n{\\large Sesión de Aprendizaje}\n\\end{center}\n\\vspace{0.4em}`,
  );

  // Datos informativos.
  body.push('\\section*{Datos informativos}');
  const datos = [
    `\\textbf{Área:} ${escapeLatex(d.area)}`,
    `\\textbf{Grado(s):} ${escapeLatex(grados)}${escapeLatex(multigrado)}`,
    `\\textbf{Lengua:} ${escapeLatex(d.lengua)}`,
    d.duracion ? `\\textbf{Duración:} ${escapeLatex(d.duracion)}` : '',
  ].filter((x) => x.length > 0);
  body.push(datos.join(' \\\\\n'));

  // Propósito general.
  body.push('\\section*{Propósito de aprendizaje}');
  body.push(escapeLatex(contenido.propositoGeneral));

  // Propósitos de aprendizaje (competencia → capacidades → desempeños → evidencia).
  body.push('\\section*{Propósitos, competencias y desempeños}');
  contenido.propositosAprendizaje.forEach((p, i) => {
    body.push(`\\subsection*{Propósito ${i + 1}}`);
    body.push(renderProposito(p));
  });

  // Enfoques transversales.
  if (contenido.enfoquesTransversales.length > 0) {
    body.push('\\section*{Enfoques transversales}');
    body.push(itemize(contenido.enfoquesTransversales));
  }

  // Secuencia didáctica (momentos).
  body.push('\\section*{Secuencia didáctica}');
  for (const m of contenido.momentos) {
    body.push(renderMomento(m));
  }

  // Materiales.
  if (contenido.materiales.length > 0) {
    body.push('\\section*{Materiales y recursos}');
    body.push(itemize(contenido.materiales));
  }

  body.push('\\end{document}');
  return body.filter((b) => b.length > 0).join('\n\n');
}
