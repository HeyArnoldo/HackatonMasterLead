import { z } from 'zod';

/** Rol de un mensaje persistido en la conversación del copiloto. */
export enum RolMensaje {
  USER = 'user',
  ASSISTANT = 'assistant',
}

/**
 * Body de `POST /api/copiloto/chat`.
 *
 * `messages` son `UIMessage[]` del cliente (`@ai-sdk/react` `useChat`). El
 * backend los valida de forma laxa (la forma exacta la garantiza el AI SDK) y
 * los convierte con `convertToModelMessages` antes de pasarlos al modelo.
 * `conversacionId` es opcional: si se omite, el backend abre una conversación
 * nueva y devuelve su id en la cabecera `X-Conversacion-Id`.
 */
export const copilotoChatRequestSchema = z.object({
  conversacionId: z.uuid().optional(),
  messages: z.array(z.unknown()).min(1),
});
export type CopilotoChatRequest = z.infer<typeof copilotoChatRequestSchema>;

/** Respuesta de `POST /api/copiloto/transcribe`. */
export const transcripcionResponseSchema = z.object({
  text: z.string(),
});
export type TranscripcionResponse = z.infer<typeof transcripcionResponseSchema>;

/** Resumen de una conversación del copiloto (para listar / reanudar). */
export const conversacionResumenSchema = z.object({
  id: z.uuid(),
  titulo: z.string(),
  lastAt: z.string(),
  createdAt: z.string(),
});
export type ConversacionResumen = z.infer<typeof conversacionResumenSchema>;

/** Un mensaje persistido de la conversación (para reanudar el chat). */
export const mensajeResumenSchema = z.object({
  id: z.uuid(),
  rol: z.enum(RolMensaje),
  contenido: z.string(),
  createdAt: z.string(),
});
export type MensajeResumen = z.infer<typeof mensajeResumenSchema>;
