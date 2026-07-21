import { z } from 'zod';

/** Tope de tamaño de la fuente LaTeX aceptada por `POST /api/pdf/compile` (~200 KB). */
export const MAX_LATEX_LENGTH = 200_000;

/**
 * Body de `POST /api/pdf/compile`: una fuente LaTeX que el backend compila a PDF
 * con tectonic. Satisface "que me genere latex" — el copiloto produce el LaTeX y
 * este endpoint lo compila. El tamaño se limita para evitar abusos.
 */
export const compilarLatexInputSchema = z.object({
  latex: z.string().min(1).max(MAX_LATEX_LENGTH),
});
export type CompilarLatexInput = z.infer<typeof compilarLatexInputSchema>;
