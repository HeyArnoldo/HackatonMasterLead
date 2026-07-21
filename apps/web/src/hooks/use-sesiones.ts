import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizarSesionInput } from '@app/contracts';
import { sesionesApi } from '@/services/sesiones.api';

const SESIONES_KEY = ['sesiones'] as const;

export function useSesiones() {
  return useQuery({
    queryKey: SESIONES_KEY,
    queryFn: sesionesApi.listar,
  });
}

export function useSesion(id: string | undefined) {
  return useQuery({
    queryKey: ['sesiones', id],
    queryFn: () => sesionesApi.obtener(id as string),
    enabled: Boolean(id),
  });
}

export function useActualizarSesion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualizarSesionInput) => sesionesApi.actualizar(id, input),
    onSuccess: (sesion) => {
      qc.setQueryData(['sesiones', id], sesion);
      void qc.invalidateQueries({ queryKey: SESIONES_KEY });
    },
  });
}
