import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelMessage } from 'ai';
import { ContenidoSesion, RolMensaje } from '@app/contracts';
import { isAiEnabled } from '../agent/ai.config';
import { CopilotoService } from '../copiloto/copiloto.service';
import { ConversacionesService } from '../copiloto/conversaciones.service';
import { TranscripcionService } from '../copiloto/transcripcion.service';
import { UsersService } from '../users/users.service';
import { ProponerSesionArgs, ProponerSesionResult } from '../copiloto/copiloto-tools';
import { WaInboundLog } from './wa-inbound-log.entity';
import { EvolutionClient } from './evolution.client';

/**
 * Forma relevante del webhook `messages.upsert` de Evolution (parseo defensivo:
 * campos opcionales, solo leemos lo que necesitamos — texto o nota de voz).
 */
export interface EvolutionWebhookPayload {
  event?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      audioMessage?: object;
      base64?: string;
    };
    messageType?: string;
  };
}

/** Últimos N mensajes del hilo que se replican como contexto del copiloto. */
const HISTORY_WINDOW = 12;

const NOMBRE_MOMENTO: Record<string, string> = {
  inicio: 'Inicio',
  desarrollo: 'Desarrollo',
  cierre: 'Cierre',
};

/**
 * Arma el resumen de una sesión validada, apto para WhatsApp (texto plano con
 * formato Markdown de WhatsApp). Incluye los DESEMPEÑOS CITADOS con su código
 * real — el diferenciador de Yachai: nunca se cita un desempeño inventado.
 * Función pura → testeable sin infraestructura.
 */
export function formatSesionWhatsapp(contenido: ContenidoSesion): string {
  const lines: string[] = [];
  lines.push('✅ *Sesión guardada como borrador*');
  lines.push(`*${contenido.titulo}*`);
  lines.push('');
  lines.push(`📌 *Propósito:* ${contenido.propositoGeneral}`);
  lines.push('');
  lines.push('🎯 *Desempeños citados (CNEB):*');
  for (const proposito of contenido.propositosAprendizaje) {
    for (const desempeno of proposito.desempenos) {
      lines.push(`• [${desempeno.codigo}] (${desempeno.grado}°) ${desempeno.descripcion}`);
    }
  }
  lines.push('');
  lines.push('🧭 *Momentos:*');
  for (const momento of contenido.momentos) {
    const nActividades =
      momento.actividades.length +
      momento.actividadesPorGrado.reduce((sum, g) => sum + g.actividades.length, 0);
    const nombre = NOMBRE_MOMENTO[momento.nombre] ?? momento.nombre;
    lines.push(`• ${nombre}: ${nActividades} actividad(es)`);
  }
  return lines.join('\n');
}

/**
 * Canal WhatsApp del copiloto de Yachai. Enruta un mensaje entrante (texto o
 * nota de voz) al MISMO copiloto conversacional del chat web (tools + Verificador)
 * y responde con su salida. Idempotente por `waMessageId`; identidad simple por
 * número (find-or-create DOCENTE, sin OTP — simplificación de hackathon).
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  // Anti-spam: a un número que no puede procesarse se le responde 1 vez/día.
  private readonly avisoEnviado = new Map<string, string>();

  constructor(
    @InjectRepository(WaInboundLog) private readonly inboundLog: Repository<WaInboundLog>,
    private readonly users: UsersService,
    private readonly copiloto: CopilotoService,
    private readonly conversaciones: ConversacionesService,
    private readonly transcripcion: TranscripcionService,
    private readonly evolution: EvolutionClient,
  ) {}

  /**
   * Pipeline del webhook: dedup → resolver docente por número → texto o voz →
   * copiloto (mismo cerebro que el chat) → responder y persistir. Idempotente
   * por `waMessageId`: los reintentos de Evolution no reprocesan nada.
   */
  async processInbound(payload: EvolutionWebhookPayload): Promise<void> {
    const data = payload.data;
    const key = data?.key;
    if (!key?.id || !key.remoteJid) return;
    if (key.fromMe) return; // jamás auto-procesarse (loop)
    if (key.remoteJid.endsWith('@g.us')) return; // grupos fuera de alcance

    // Dedup por PK: si ya está logueado, es un reintento del webhook.
    const yaProcesado = await this.inboundLog.exists({ where: { waMessageId: key.id } });
    if (yaProcesado) return;
    await this.inboundLog.save(
      this.inboundLog.create({ waMessageId: key.id, payload: payload as object }),
    );

    const e164 = `+${key.remoteJid.split('@')[0]}`;

    // Sin IA no hay copiloto: responde con cortesía y no rompe el resto.
    if (!isAiEnabled()) {
      await this.avisar(e164, 'El copiloto de Yachai no está disponible en este momento.');
      return;
    }

    // Texto directo o nota de voz transcrita — luego comparten pipeline.
    let text = data?.message?.conversation ?? data?.message?.extendedTextMessage?.text ?? null;
    let voz = false;

    if (!text && data?.message?.audioMessage) {
      voz = true;
      const base64 = data.message.base64 ?? (await this.evolution.getBase64(key.id));
      if (base64) {
        try {
          text = await this.transcripcion.transcribe(Buffer.from(base64, 'base64'));
        } catch (err) {
          this.logger.error(`transcripción falló: ${String(err)}`);
          text = null;
        }
      }
      if (!text) {
        await this.evolution.sendText(
          e164,
          'No pude entender la nota de voz. ¿Podés escribirme el mensaje o mandar otro audio?',
        );
        return;
      }
    }

    if (!text) {
      await this.evolution.sendText(
        e164,
        'Por ahora puedo leer mensajes de texto o notas de voz. ¿Me contás qué sesión querés preparar?',
      );
      return;
    }

    // Identidad simple (hackathon): número → docente (find-or-create, sin OTP).
    const docente = await this.users.findOrCreateByPhone(e164, data?.pushName ?? undefined);
    const reply = await this.responder(docente.id, text, voz);
    await this.evolution.sendText(e164, reply);
  }

  /**
   * Corre el copiloto sobre el hilo WhatsApp del docente y devuelve la respuesta
   * (texto del asistente + resumen de la sesión si el Verificador la aprobó).
   */
  private async responder(docenteId: string, text: string, voz: boolean): Promise<string> {
    const conv = await this.conversaciones.asegurarHiloWhatsapp(docenteId);
    await this.conversaciones.agregarMensaje(conv, RolMensaje.USER, voz ? `🎤 ${text}` : text);

    const history = await this.historial(docenteId, conv.id);
    const result = this.copiloto.run(docenteId, history);
    const [texto, toolCalls, toolResults] = await Promise.all([
      result.text,
      result.toolCalls,
      result.toolResults,
    ]);
    const respuesta = texto.trim();

    await this.conversaciones.agregarMensaje(
      conv,
      RolMensaje.ASSISTANT,
      respuesta,
      toolCalls.length > 0 ? toolCalls : null,
    );

    const resumen = this.resumenSesionValidada(toolResults);
    return resumen ? `${respuesta}\n\n${resumen}` : respuesta;
  }

  /** Últimos N mensajes del hilo como contexto del copiloto (memoria). */
  private async historial(docenteId: string, conversacionId: string): Promise<ModelMessage[]> {
    const mensajes = await this.conversaciones.listarMensajes(docenteId, conversacionId);
    return mensajes.slice(-HISTORY_WINDOW).map((m) => ({
      role: m.rol === RolMensaje.USER ? ('user' as const) : ('assistant' as const),
      content: m.contenido,
    }));
  }

  /**
   * Si el copiloto propuso una sesión y el Verificador la aprobó (`valid` +
   * `sesionId`), arma el resumen WhatsApp con los desempeños citados. Devuelve
   * null si no hubo sesión validada en este turno.
   */
  private resumenSesionValidada(toolResults: readonly unknown[]): string | null {
    for (let i = toolResults.length - 1; i >= 0; i--) {
      const tr = toolResults[i] as { toolName?: string; input?: unknown; output?: unknown };
      if (tr.toolName !== 'proponer_sesion') continue;
      const output = tr.output as ProponerSesionResult | undefined;
      if (!output?.valid || !output.sesionId) continue;
      const input = tr.input as ProponerSesionArgs | undefined;
      if (!input?.contenidoJson) continue;
      return formatSesionWhatsapp(input.contenidoJson);
    }
    return null;
  }

  /** Aviso con anti-spam: máximo una vez por día por número. */
  private async avisar(e164: string, mensaje: string): Promise<void> {
    const hoy = new Date().toDateString();
    if (this.avisoEnviado.get(e164) === hoy) return;
    this.avisoEnviado.set(e164, hoy);
    await this.evolution.sendText(e164, mensaje);
  }
}
