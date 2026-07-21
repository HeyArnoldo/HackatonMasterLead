/**
 * Utilidades de escape de LaTeX. Todo texto proveniente del usuario o de la IA
 * pasa por `escapeLatex` ANTES de inyectarse en una plantilla `.tex`, para que
 * caracteres especiales (\, {, }, $, &, %, #, _, ^, ~) no rompan la compilación
 * ni permitan inyección de comandos. Trivial de escribir → no añadimos una dep.
 */

/**
 * Mapa de caracteres especiales de LaTeX a su forma escapada. Se aplica en UNA
 * sola pasada (la salida no se vuelve a escanear), de modo que las llaves que
 * introducen `\textbackslash{}` / `\textasciitilde{}` no se re-escapan.
 */
const SPECIALS: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '%': '\\%',
  '#': '\\#',
  _: '\\_',
  '^': '\\textasciicircum{}',
  '~': '\\textasciitilde{}',
};

const SPECIALS_RE = /[\\{}$&%#_^~]/g;

/**
 * Escapa un texto plano para insertarlo con seguridad en un documento LaTeX.
 * Acepta `unknown` (lo coacciona a string) para tolerar contenido dinámico.
 */
export function escapeLatex(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(SPECIALS_RE, (ch) => SPECIALS[ch] ?? ch);
}

/** Escapa una lista de textos (helper para `\item` repetidos). */
export function escapeLatexList(items: readonly unknown[]): string[] {
  return items.map((i) => escapeLatex(i));
}
