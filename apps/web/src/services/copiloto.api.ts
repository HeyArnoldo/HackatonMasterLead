import { api } from '@/lib/api';
import type { ConversacionResumen, MensajeResumen, TranscripcionResponse } from '@app/contracts';

/**
 * Endpoint del chat en streaming. En dev queda relativo (`/api/...`) y el proxy
 * de Vite lo reenvía; en prod usa la URL absoluta. `useChat` pega aquí con su
 * propio `fetch`, por eso pasamos `credentials: 'include'` en el transport.
 */
export const chatEndpoint = `${import.meta.env.VITE_API_URL ?? ''}/api/copiloto/chat`;

export const copilotoApi = {
  /** Abre un hilo nuevo y devuelve su id (para pasarlo en el body del chat). */
  crearConversacion: async (): Promise<ConversacionResumen> =>
    (await api.post<ConversacionResumen>('/copiloto/conversaciones')).data,

  listarConversaciones: async (): Promise<ConversacionResumen[]> =>
    (await api.get<ConversacionResumen[]>('/copiloto/conversaciones')).data,

  listarMensajes: async (id: string): Promise<MensajeResumen[]> =>
    (await api.get<MensajeResumen[]>(`/copiloto/conversaciones/${id}/mensajes`)).data,

  /** Manda un blob de audio del micrófono y devuelve el texto transcrito. */
  transcribir: async (audio: Blob): Promise<string> => {
    const form = new FormData();
    form.append('audio', audio, 'voz.webm');
    const { data } = await api.post<TranscripcionResponse>('/copiloto/transcribe', form);
    return data.text;
  },
};
