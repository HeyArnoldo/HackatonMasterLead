import { z } from 'zod';

export const escuelaSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  ugel: z.string(),
  esUnidocente: z.boolean(),
  esMultigrado: z.boolean(),
  lenguas: z.array(z.string()),
});
export type Escuela = z.infer<typeof escuelaSchema>;

export const crearEscuelaInputSchema = escuelaSchema.omit({ id: true }).extend({
  esUnidocente: z.boolean().default(false),
  esMultigrado: z.boolean().default(false),
  lenguas: z.array(z.string()).default([]),
});
export type CrearEscuelaInput = z.infer<typeof crearEscuelaInputSchema>;
