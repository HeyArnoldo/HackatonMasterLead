import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { experimental_transcribe as transcribe } from 'ai';
import { isAiEnabled, transcriptionModel, transcriptionModelName } from '../agent/ai.config';

/**
 * Transcripción de voz a texto (OpenAI directo, vía AI SDK). Espeja la forma del
 * `TranscriptionService` de mayordomo: recibe el audio como Buffer y devuelve el
 * texto. El formato (webm/ogg/mp4/wav/mpeg) se detecta por los magic bytes del
 * propio audio, así que el micrófono del navegador funciona sin metadatos extra.
 */
@Injectable()
export class TranscripcionService {
  private readonly logger = new Logger(TranscripcionService.name);

  /** ¿Está habilitada la transcripción (hay credenciales de IA)? */
  enabled(): boolean {
    return isAiEnabled();
  }

  async transcribe(audio: Buffer): Promise<string> {
    if (!isAiEnabled()) {
      throw new ServiceUnavailableException(
        'La transcripción requiere OPENAI_API_KEY en el entorno.',
      );
    }
    const { text } = await transcribe({
      model: transcriptionModel(),
      audio,
      providerOptions: { openai: { language: 'es' } },
    });
    this.logger.log(`Transcripción OK (${transcriptionModelName()}): ${text.length} caracteres.`);
    return text.trim();
  }
}
