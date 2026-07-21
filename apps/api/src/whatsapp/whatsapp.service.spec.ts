import { Repository } from 'typeorm';
import { ContenidoSesion, RolMensaje } from '@app/contracts';
import { WhatsappService, EvolutionWebhookPayload, formatSesionWhatsapp } from './whatsapp.service';
import { WaInboundLog } from './wa-inbound-log.entity';
import { EvolutionClient } from './evolution.client';

/**
 * Cerebro del canal WhatsApp. Se mockean TODAS las dependencias (sin red ni DB):
 * las pruebas verifican idempotencia, el ruteo texto-vs-voz y que la respuesta
 * del copiloto se envíe por Evolution. La lógica del copiloto/Verificador se
 * prueba en sus propios specs.
 */
function makeInboundLog(): { repo: Repository<WaInboundLog>; ids: Set<string> } {
  const ids = new Set<string>();
  const repo = {
    exists: jest.fn(({ where }: { where: { waMessageId: string } }) =>
      Promise.resolve(ids.has(where.waMessageId)),
    ),
    create: jest.fn((x: { waMessageId: string }) => x),
    save: jest.fn((x: { waMessageId: string }) => {
      ids.add(x.waMessageId);
      return Promise.resolve(x);
    }),
  } as unknown as Repository<WaInboundLog>;
  return { repo, ids };
}

function makeRunResult(text: string, toolResults: unknown[] = []) {
  return {
    text: Promise.resolve(text),
    toolCalls: Promise.resolve([]),
    toolResults: Promise.resolve(toolResults),
  };
}

function setup(runResult = makeRunResult('Respuesta del copiloto')) {
  const { repo, ids } = makeInboundLog();

  const users = { findOrCreateByPhone: jest.fn().mockResolvedValue({ id: 'doc-1' }) };
  const conversaciones = {
    asegurarHiloWhatsapp: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    agregarMensaje: jest.fn().mockResolvedValue(undefined),
    listarMensajes: jest.fn().mockResolvedValue([{ rol: RolMensaje.USER, contenido: 'hola' }]),
  };
  const copiloto = { run: jest.fn().mockReturnValue(runResult) };
  const transcripcion = { transcribe: jest.fn().mockResolvedValue('texto transcrito') };
  const evolution = {
    sendText: jest.fn().mockResolvedValue(undefined),
    getBase64: jest.fn().mockResolvedValue('QUJD'),
  } as unknown as EvolutionClient;

  const service = new WhatsappService(
    repo,
    users as never,
    copiloto as never,
    conversaciones as never,
    transcripcion as never,
    evolution,
  );
  return { service, repo, ids, users, conversaciones, copiloto, transcripcion, evolution };
}

const textPayload: EvolutionWebhookPayload = {
  event: 'messages.upsert',
  data: {
    key: { id: 'MSG-TEXT', remoteJid: '51999888777@s.whatsapp.net' },
    message: { conversation: 'Quiero preparar una sesión de Comunicación' },
  },
};

const audioPayload: EvolutionWebhookPayload = {
  event: 'messages.upsert',
  data: {
    key: { id: 'MSG-AUDIO', remoteJid: '51999888777@s.whatsapp.net' },
    message: { audioMessage: {}, base64: 'QUJD' },
  },
};

describe('WhatsappService', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test';
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    jest.restoreAllMocks();
  });

  it('es idempotente: el mismo waMessageId dos veces procesa una sola vez', async () => {
    const { service, copiloto, evolution } = setup();
    await service.processInbound(textPayload);
    await service.processInbound(textPayload);
    expect(copiloto.run).toHaveBeenCalledTimes(1);
    expect(evolution.sendText).toHaveBeenCalledTimes(1);
  });

  it('ruteo de TEXTO: no transcribe y responde con la salida del copiloto', async () => {
    const { service, transcripcion, copiloto, evolution } = setup();
    await service.processInbound(textPayload);
    expect(transcripcion.transcribe).not.toHaveBeenCalled();
    expect(copiloto.run).toHaveBeenCalledTimes(1);
    expect(evolution.sendText).toHaveBeenCalledWith('+51999888777', 'Respuesta del copiloto');
  });

  it('ruteo de VOZ: descarga, transcribe y enruta al copiloto', async () => {
    const { service, transcripcion, copiloto, evolution } = setup();
    await service.processInbound(audioPayload);
    expect(transcripcion.transcribe).toHaveBeenCalledTimes(1);
    expect(copiloto.run).toHaveBeenCalledTimes(1);
    expect(evolution.sendText).toHaveBeenCalledWith('+51999888777', 'Respuesta del copiloto');
  });

  it('si la transcripción falla, pide reintentar y no llama al copiloto', async () => {
    const { service, transcripcion, copiloto, evolution } = setup();
    (transcripcion.transcribe as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    (evolution.getBase64 as jest.Mock).mockResolvedValueOnce(null);
    await service.processInbound(audioPayload);
    expect(copiloto.run).not.toHaveBeenCalled();
    expect(evolution.sendText).toHaveBeenCalledTimes(1);
  });

  it('ignora mensajes propios (fromMe) y de grupos', async () => {
    const { service, copiloto } = setup();
    await service.processInbound({
      data: { key: { id: 'A', remoteJid: '51999@s.whatsapp.net', fromMe: true } },
    });
    await service.processInbound({
      data: { key: { id: 'B', remoteJid: '123@g.us' }, message: { conversation: 'hola' } },
    });
    expect(copiloto.run).not.toHaveBeenCalled();
  });

  it('sin OPENAI_API_KEY responde con cortesía y no llama al copiloto', async () => {
    delete process.env.OPENAI_API_KEY;
    const { service, copiloto, evolution } = setup();
    await service.processInbound(textPayload);
    expect(copiloto.run).not.toHaveBeenCalled();
    expect(evolution.sendText).toHaveBeenCalledTimes(1);
  });

  it('adjunta el resumen de la sesión validada (con desempeños citados)', async () => {
    const toolResults = [
      {
        toolName: 'proponer_sesion',
        input: { contenidoJson: contenidoDummy },
        output: { ok: true, valid: true, sesionId: 'ses-1' },
      },
    ];
    const { service, evolution } = setup(makeRunResult('Listo, docente', toolResults));
    await service.processInbound(textPayload);
    const enviado = (evolution.sendText as jest.Mock).mock.calls[0][1] as string;
    expect(enviado).toContain('DES-1');
    expect(enviado).toContain('Sesión guardada');
  });
});

const contenidoDummy = {
  titulo: 'La chacra y los números',
  datosInformativos: { area: 'Matemática', grados: [1, 2], lengua: 'castellano' },
  propositoGeneral: 'Contar productos de la chacra',
  propositosAprendizaje: [
    {
      competenciaCodigo: 'C1',
      competenciaNombre: 'Resuelve problemas de cantidad',
      capacidades: [],
      desempenos: [{ codigo: 'DES-1', descripcion: 'Cuenta objetos hasta 10', grado: 1 }],
      evidencia: 'Cuenta productos',
    },
  ],
  enfoquesTransversales: [],
  momentos: [
    { nombre: 'inicio', actividades: ['saludo'], actividadesPorGrado: [], recursos: [] },
    { nombre: 'desarrollo', actividades: ['conteo'], actividadesPorGrado: [], recursos: [] },
    { nombre: 'cierre', actividades: ['cierre'], actividadesPorGrado: [], recursos: [] },
  ],
  materiales: [],
} as ContenidoSesion;

describe('formatSesionWhatsapp', () => {
  it('incluye título, propósito y los desempeños con su código', () => {
    const out = formatSesionWhatsapp(contenidoDummy);
    expect(out).toContain('La chacra y los números');
    expect(out).toContain('Contar productos de la chacra');
    expect(out).toContain('[DES-1]');
    expect(out).toContain('Inicio');
  });
});
