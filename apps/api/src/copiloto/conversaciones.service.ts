import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolMensaje } from '@app/contracts';
import { Conversacion } from './conversacion.entity';
import { Mensaje } from './mensaje.entity';

/**
 * Persistencia de conversaciones y mensajes del copiloto. Espeja
 * `ConversationsService` de mayordomo: crear/listar/obtener hilos y anexar
 * mensajes refrescando `lastAt`.
 */
@Injectable()
export class ConversacionesService {
  constructor(
    @InjectRepository(Conversacion) private readonly conversaciones: Repository<Conversacion>,
    @InjectRepository(Mensaje) private readonly mensajes: Repository<Mensaje>,
  ) {}

  async crear(docenteId: string, titulo?: string): Promise<Conversacion> {
    return this.conversaciones.save(
      this.conversaciones.create({ docenteId, ...(titulo ? { titulo } : {}) }),
    );
  }

  async listar(docenteId: string): Promise<Conversacion[]> {
    return this.conversaciones.find({ where: { docenteId }, order: { lastAt: 'DESC' } });
  }

  /** Carga una conversación del docente. 404 si no existe o no es suya. */
  async obtener(docenteId: string, id: string): Promise<Conversacion> {
    const conv = await this.conversaciones.findOne({ where: { id, docenteId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada.');
    return conv;
  }

  /** Mensajes del hilo (orden cronológico). Verifica pertenencia primero. */
  async listarMensajes(docenteId: string, conversacionId: string): Promise<Mensaje[]> {
    await this.obtener(docenteId, conversacionId);
    return this.mensajes.find({ where: { conversacionId }, order: { createdAt: 'ASC' } });
  }

  /** Persiste un mensaje y refresca `lastAt` de la conversación. */
  async agregarMensaje(
    conv: Conversacion,
    rol: RolMensaje,
    contenido: string,
    toolCalls: unknown | null = null,
  ): Promise<Mensaje> {
    const mensaje = await this.mensajes.save(
      this.mensajes.create({ conversacionId: conv.id, rol, contenido, toolCalls }),
    );
    conv.lastAt = new Date();
    await this.conversaciones.save(conv);
    return mensaje;
  }
}
