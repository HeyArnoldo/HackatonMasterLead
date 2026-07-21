import { z } from 'zod';

/** Estado de la sesión de aprendizaje. */
export enum EstadoSesion {
  BORRADOR = 'borrador',
  FINAL = 'final',
}

/**
 * Entrada para generar una sesión de aprendizaje (Fase 2 consume esto).
 * area: nombre del área curricular; el servicio resuelve el areaId.
 */
export const crearSesionInputSchema = z.object({
  area: z.string().min(1),
  grados: z.array(z.number().int().min(1).max(6)).min(1),
  tema: z.string().min(1),
  lengua: z.string().min(1),
  contexto: z.string().optional(),
  competenciaIds: z.array(z.uuid()).default([]),
});
export type CrearSesionInput = z.infer<typeof crearSesionInputSchema>;

/**
 * Estructura canónica del `contenidoJson` de una sesión de aprendizaje,
 * derivada de la sesión oficial peruana (datos informativos → propósitos de
 * aprendizaje → enfoques transversales → momentos → materiales).
 *
 * Es la forma que produce la IA y que el Verificador valida antes de guardar.
 */

/** Un desempeño citado por la sesión. `codigo` DEBE existir en la tabla `desempeno`. */
export const desempenoCitadoSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  grado: z.number().int().min(1).max(6),
});
export type DesempenoCitado = z.infer<typeof desempenoCitadoSchema>;

/** Actividades diferenciadas para un grado (clave del multigrado). */
export const actividadesGradoSchema = z.object({
  grado: z.number().int().min(1).max(6),
  actividades: z.array(z.string().min(1)).min(1),
});
export type ActividadesGrado = z.infer<typeof actividadesGradoSchema>;

/** Nombre de cada momento de la secuencia didáctica. */
export enum MomentoNombre {
  INICIO = 'inicio',
  DESARROLLO = 'desarrollo',
  CIERRE = 'cierre',
}

/**
 * Un momento de la sesión (inicio / desarrollo / cierre).
 * - `actividades`: actividades comunes a todos los grados.
 * - `actividadesPorGrado`: actividades diferenciadas por grado (multigrado).
 *   Al menos uno de los dos debe traer contenido.
 */
export const momentoSchema = z.object({
  nombre: z.enum(MomentoNombre),
  tiempo: z.string().optional(),
  actividades: z.array(z.string().min(1)).default([]),
  actividadesPorGrado: z.array(actividadesGradoSchema).default([]),
  recursos: z.array(z.string()).default([]),
});
export type Momento = z.infer<typeof momentoSchema>;

/**
 * Propósito de aprendizaje: competencia → capacidades → desempeños citados
 * (con su código real) → evidencia. El Verificador exige al menos un desempeño.
 */
export const propositoAprendizajeSchema = z.object({
  competenciaCodigo: z.string().min(1),
  competenciaNombre: z.string().min(1),
  capacidades: z.array(z.string()).default([]),
  desempenos: z.array(desempenoCitadoSchema).min(1),
  evidencia: z.string().min(1),
});
export type PropositoAprendizaje = z.infer<typeof propositoAprendizajeSchema>;

export const contenidoSesionSchema = z.object({
  titulo: z.string().min(1),
  datosInformativos: z.object({
    area: z.string().min(1),
    grados: z.array(z.number().int().min(1).max(6)).min(1),
    lengua: z.string().min(1),
    duracion: z.string().optional(),
  }),
  propositoGeneral: z.string().min(1),
  propositosAprendizaje: z.array(propositoAprendizajeSchema).min(1),
  enfoquesTransversales: z.array(z.string()).default([]),
  momentos: z.array(momentoSchema).min(1),
  materiales: z.array(z.string()).default([]),
});
export type ContenidoSesion = z.infer<typeof contenidoSesionSchema>;

export const sesionAprendizajeSchema = z.object({
  id: z.uuid(),
  docenteId: z.uuid(),
  escuelaId: z.uuid().nullable(),
  grados: z.array(z.number().int()),
  areaId: z.uuid().nullable(),
  competenciaIds: z.array(z.uuid()),
  lengua: z.string(),
  contexto: z.string().nullable(),
  contenidoJson: z.unknown().nullable(),
  estado: z.enum(EstadoSesion),
  generationAuditId: z.uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SesionAprendizaje = z.infer<typeof sesionAprendizajeSchema>;
