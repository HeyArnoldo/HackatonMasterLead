import { z } from 'zod';

/** Ciclo del CNEB (Currículo Nacional de la Educación Básica) asociado a un estándar. */
export enum Ciclo {
  III = 'III',
  IV = 'IV',
  V = 'V',
}

/** Área curricular con su árbol de competencias. */
export const curriculumAreaSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
});
export type CurriculumArea = z.infer<typeof curriculumAreaSchema>;

export const competenciaSchema = z.object({
  id: z.uuid(),
  areaId: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
});
export type Competencia = z.infer<typeof competenciaSchema>;

export const capacidadSchema = z.object({
  id: z.uuid(),
  competenciaId: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
});
export type Capacidad = z.infer<typeof capacidadSchema>;

export const estandarSchema = z.object({
  id: z.uuid(),
  competenciaId: z.uuid(),
  ciclo: z.enum(Ciclo),
  descripcion: z.string(),
});
export type Estandar = z.infer<typeof estandarSchema>;

export const desempenoSchema = z.object({
  id: z.uuid(),
  competenciaId: z.uuid(),
  grado: z.number().int().min(1).max(6),
  /** null => requiere revisión, no es citable por el Verificador. */
  codigo: z.string().nullable(),
  descripcion: z.string(),
  needsReview: z.boolean(),
});
export type Desempeno = z.infer<typeof desempenoSchema>;
