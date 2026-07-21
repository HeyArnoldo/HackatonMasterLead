import { api } from '@/lib/api';
import type { ActualizarSesionInput, SesionDetalle, SesionResumen } from '@app/contracts';

export const sesionesApi = {
  listar: async (): Promise<SesionResumen[]> => (await api.get<SesionResumen[]>('/sesiones')).data,

  obtener: async (id: string): Promise<SesionDetalle> =>
    (await api.get<SesionDetalle>(`/sesiones/${id}`)).data,

  actualizar: async (id: string, input: ActualizarSesionInput): Promise<SesionDetalle> =>
    (await api.patch<SesionDetalle>(`/sesiones/${id}`, input)).data,
};
