import { api } from '@/lib/api';
import type { ActualizarSesionInput, SesionDetalle, SesionResumen } from '@app/contracts';

export const sesionesApi = {
  listar: async (): Promise<SesionResumen[]> => (await api.get<SesionResumen[]>('/sesiones')).data,

  obtener: async (id: string): Promise<SesionDetalle> =>
    (await api.get<SesionDetalle>(`/sesiones/${id}`)).data,

  actualizar: async (id: string, input: ActualizarSesionInput): Promise<SesionDetalle> =>
    (await api.patch<SesionDetalle>(`/sesiones/${id}`, input)).data,

  /**
   * Descarga el PDF de la sesión (`GET /api/sesiones/:id/pdf`). El endpoint lo
   * agrega una fase paralela; si aún no existe (404/503) el llamador degrada con
   * un toast. Devuelve un Blob para abrir en una pestaña nueva.
   */
  pdf: async (id: string): Promise<Blob> =>
    (await api.get(`/sesiones/${id}/pdf`, { responseType: 'blob' })).data,
};
