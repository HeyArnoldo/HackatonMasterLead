import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { EvolutionWebhookPayload, WhatsappService } from './whatsapp.service';

/**
 * Webhook PÚBLICO de Evolution (sin `JwtAuthGuard`): Evolution no manda JWT.
 * La seguridad es por token compartido: se configura el MISMO valor en
 * `WA_WEBHOOK_TOKEN` y en el header (`x-webhook-token`) o query (`?token=`) del
 * webhook de Evolution. Responde 200 al instante y procesa en background para
 * no acumular reintentos del lado de Evolution.
 */
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsapp: WhatsappService) {}

  @Post('webhook')
  @HttpCode(200)
  receive(
    @Body() payload: EvolutionWebhookPayload,
    @Headers('x-webhook-token') headerToken: string | undefined,
    @Query('token') queryToken: string | undefined,
  ): { ok: true } {
    const expected = process.env.WA_WEBHOOK_TOKEN;
    if (expected && headerToken !== expected && queryToken !== expected) {
      throw new UnauthorizedException();
    }
    if (!expected) {
      this.logger.warn('WA_WEBHOOK_TOKEN no configurado — webhook abierto (solo dev).');
    }

    // 200 inmediato; el procesamiento (transcripción + copiloto) sigue async.
    void this.whatsapp
      .processInbound(payload)
      .catch((err) => this.logger.error(`webhook falló: ${String(err)}`));
    return { ok: true };
  }
}
