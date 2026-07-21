import { UnauthorizedException } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService, EvolutionWebhookPayload } from './whatsapp.service';

/**
 * El webhook es PÚBLICO: su única defensa es el token compartido
 * (`WA_WEBHOOK_TOKEN`). Estas pruebas verifican que un token forjado se rechaza
 * y que uno válido (por header o query) pasa y dispara el procesamiento.
 */
describe('WhatsappController (webhook token)', () => {
  let controller: WhatsappController;
  let processInbound: jest.Mock;

  const payload: EvolutionWebhookPayload = {
    event: 'messages.upsert',
    data: { key: { id: 'MSG1', remoteJid: '51999@s.whatsapp.net' } },
  };

  beforeEach(() => {
    processInbound = jest.fn().mockResolvedValue(undefined);
    const service = { processInbound } as unknown as WhatsappService;
    controller = new WhatsappController(service);
  });

  afterEach(() => {
    delete process.env.WA_WEBHOOK_TOKEN;
    jest.restoreAllMocks();
  });

  it('rechaza un token forjado (header y query incorrectos)', () => {
    process.env.WA_WEBHOOK_TOKEN = 'secreto';
    expect(() => controller.receive(payload, 'malo', 'tambien-malo')).toThrow(
      UnauthorizedException,
    );
    expect(processInbound).not.toHaveBeenCalled();
  });

  it('acepta el token correcto por header', () => {
    process.env.WA_WEBHOOK_TOKEN = 'secreto';
    expect(controller.receive(payload, 'secreto', undefined)).toEqual({ ok: true });
    expect(processInbound).toHaveBeenCalledTimes(1);
  });

  it('acepta el token correcto por query', () => {
    process.env.WA_WEBHOOK_TOKEN = 'secreto';
    expect(controller.receive(payload, undefined, 'secreto')).toEqual({ ok: true });
    expect(processInbound).toHaveBeenCalledTimes(1);
  });

  it('sin WA_WEBHOOK_TOKEN configurado, no bloquea (modo dev)', () => {
    expect(controller.receive(payload, undefined, undefined)).toEqual({ ok: true });
    expect(processInbound).toHaveBeenCalledTimes(1);
  });
});
