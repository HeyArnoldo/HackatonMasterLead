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
