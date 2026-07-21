import { useQuery } from '@tanstack/react-query';
import { copilotoApi } from '@/services/copiloto.api';

export function useConversaciones() {
  return useQuery({
    queryKey: ['conversaciones'],
    queryFn: copilotoApi.listarConversaciones,
  });
}
