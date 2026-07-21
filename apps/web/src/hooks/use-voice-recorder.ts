import { useCallback, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { copilotoApi } from '@/services/copiloto.api';

type Status = 'idle' | 'recording' | 'transcribing';

/**
 * Graba audio del micrófono con MediaRecorder y lo transcribe vía el backend.
 * `onText` recibe el texto para volcarlo en el input del chat (el docente lo
 * revisa antes de enviar). Maneja 503 (IA sin configurar) y permisos negados.
 */
export function useVoiceRecorder(onText: (text: string) => void) {
  const [status, setStatus] = useState<Status>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        // Descarta clics accidentales (blobs diminutos).
        if (blob.size < 1000) {
          setStatus('idle');
          return;
        }
        setStatus('transcribing');
        try {
          const text = await copilotoApi.transcribir(blob);
          if (text.trim()) onText(text.trim());
        } catch (err) {
          if (err instanceof AxiosError && err.response?.status === 503) {
            toast.error('La transcripción de voz aún no está configurada.');
          } else {
            toast.error('No se pudo transcribir el audio.');
          }
        } finally {
          setStatus('idle');
        }
      };

      recorder.start();
      setStatus('recording');
    } catch {
      toast.error('No se pudo acceder al micrófono. Revisa los permisos.');
      setStatus('idle');
    }
  }, [onText]);

  const toggle = useCallback(() => {
    if (status === 'recording') stop();
    else if (status === 'idle') void start();
  }, [status, start, stop]);

  return { status, toggle };
}
