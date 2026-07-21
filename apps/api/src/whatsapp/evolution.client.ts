import { Injectable, Logger } from '@nestjs/common';

/**
 * Cliente HTTP de Evolution API (WhatsApp). Plug & play por entorno: si faltan
 * las credenciales (`EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`),
 * los envíos se loguean y no rompen nada — el resto de Yachai arranca igual.
 * La clave se lee de `process.env`; nunca se hardcodea.
 */
@Injectable()
export class EvolutionClient {
  private readonly logger = new Logger(EvolutionClient.name);

  /** ¿Hay credenciales de Evolution configuradas? */
  enabled(): boolean {
    return Boolean(
      process.env.EVOLUTION_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE,
    );
  }

  private base(): string {
    return (process.env.EVOLUTION_URL ?? '').replace(/\/$/, '');
  }

  /** Envía texto a un número (E.164 sin '+', formato Evolution). */
  async sendText(e164: string, text: string): Promise<void> {
    if (!this.enabled()) {
      this.logger.warn(`[dev] sendText a ${e164}: ${text.slice(0, 80)}…`);
      return;
    }
    const number = e164.replace('+', '');
    const res = await fetch(`${this.base()}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EVOLUTION_API_KEY!,
      },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      this.logger.error(`sendText falló (${res.status}): ${await res.text()}`);
    }
  }

  /** Descarga el media de un mensaje en base64 (cuando el webhook no lo trae). */
  async getBase64(messageId: string): Promise<string | null> {
    if (!this.enabled()) return null;
    const res = await fetch(
      `${this.base()}/chat/getBase64FromMediaMessage/${process.env.EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
      },
    );
    if (!res.ok) {
      this.logger.error(`getBase64 falló (${res.status})`);
      return null;
    }
    const data = (await res.json()) as { base64?: string };
    return data.base64 ?? null;
  }

  /**
   * Envía un documento (por URL) a un número. Preparado para una fase futura
   * (ej. el PDF de la sesión); hoy la sesión se resume en texto.
   */
  async sendDocument(e164: string, url: string, fileName: string): Promise<void> {
    if (!this.enabled()) {
      this.logger.warn(`[dev] sendDocument a ${e164}: ${fileName}`);
      return;
    }
    const number = e164.replace('+', '');
    const res = await fetch(`${this.base()}/message/sendMedia/${process.env.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EVOLUTION_API_KEY!,
      },
      body: JSON.stringify({ number, mediatype: 'document', media: url, fileName }),
    });
    if (!res.ok) {
      this.logger.error(`sendDocument falló (${res.status}): ${await res.text()}`);
    }
  }
}
