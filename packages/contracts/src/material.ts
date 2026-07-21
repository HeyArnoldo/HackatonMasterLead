import { z } from 'zod';

/** Tipo de material derivado de una sesión de aprendizaje. */
export enum TipoMaterial {
  FICHA_ESTUDIANTE = 'fichaEstudiante',
  GUIA_DOCENTE = 'guiaDocente',
  AUDIO_GUION = 'audioGuion',
}

export const materialSchema = z.object({
  id: z.uuid(),
  sesionId: z.uuid(),
  tipo: z.enum(TipoMaterial),
  lengua: z.string(),
  contenido: z.unknown(),
});
export type Material = z.infer<typeof materialSchema>;
