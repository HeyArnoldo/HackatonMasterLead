import { z } from 'zod';

/** Estado de la evaluación (espeja el ciclo de la sesión: borrador → final). */
export enum EstadoEvaluacion {
  BORRADOR = 'borrador',
  FINAL = 'final',
}

/** Tipo de ítem/pregunta de la evaluación. */
export enum TipoItemEvaluacion {
  OPCION_MULTIPLE = 'opcionMultiple',
  VERDADERO_FALSO = 'verdaderoFalso',
  RESPUESTA_ABIERTA = 'respuestaAbierta',
}

/**
 * Entrada para generar una evaluación desde la conversación.
 * `area` es el nombre del área; el servicio resuelve el `areaId`.
 */
export const crearEvaluacionInputSchema = z.object({
  area: z.string().min(1),
  grado: z.number().int().min(1).max(6),
  tema: z.string().min(1),
  competenciaIds: z.array(z.uuid()).default([]),
});
export type CrearEvaluacionInput = z.infer<typeof crearEvaluacionInputSchema>;

/**
 * Un ítem de la evaluación. `desempenoCodigo` DEBE existir en la tabla
 * `desempeno` (mismo blindaje del Verificador que las sesiones): cada pregunta
 * queda anclada a un desempeño real del CNEB, jamás inventado.
 */
export const itemEvaluacionSchema = z.object({
  enunciado: z.string().min(1),
  tipo: z.enum(TipoItemEvaluacion),
  /** Solo para `opcionMultiple` / `verdaderoFalso`. */
  opciones: z.array(z.string().min(1)).default([]),
  /** Respuesta esperada / clave (para el docente). */
  respuestaEsperada: z.string().optional(),
  /** Código oficial del desempeño evaluado (debe existir en la BD). */
  desempenoCodigo: z.string().min(1),
  puntaje: z.number().nonnegative().default(1),
});
export type ItemEvaluacion = z.infer<typeof itemEvaluacionSchema>;

/**
 * Estructura canónica del `contenidoJson` de una evaluación: una prueba alineada
 * al currículo, con ítems anclados a desempeños reales. Es la forma que produce
 * la IA y que el Verificador valida (integridad de citas) antes de guardar.
 */
export const contenidoEvaluacionSchema = z.object({
  titulo: z.string().min(1),
  area: z.string().min(1),
  grado: z.number().int().min(1).max(6),
  instrucciones: z.string().min(1),
  items: z.array(itemEvaluacionSchema).min(1),
  puntajeTotal: z.number().nonnegative(),
});
export type ContenidoEvaluacion = z.infer<typeof contenidoEvaluacionSchema>;

/** Resumen de evaluación para el listado del docente. */
export const evaluacionResumenSchema = z.object({
  id: z.uuid(),
  titulo: z.string().nullable(),
  area: z.string().nullable(),
  grado: z.number().int(),
  estado: z.enum(EstadoEvaluacion),
  createdAt: z.string(),
});
export type EvaluacionResumen = z.infer<typeof evaluacionResumenSchema>;

/** Detalle completo de una evaluación. */
export const evaluacionDetalleSchema = z.object({
  id: z.uuid(),
  titulo: z.string().nullable(),
  area: z.string().nullable(),
  areaId: z.uuid().nullable(),
  grado: z.number().int(),
  competenciaIds: z.array(z.uuid()),
  estado: z.enum(EstadoEvaluacion),
  contenidoJson: contenidoEvaluacionSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EvaluacionDetalle = z.infer<typeof evaluacionDetalleSchema>;
