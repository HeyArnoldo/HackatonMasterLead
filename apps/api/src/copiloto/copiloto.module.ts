import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agent/agent.module';
import { Conversacion } from './conversacion.entity';
import { Mensaje } from './mensaje.entity';
import { ConversacionesService } from './conversaciones.service';
import { CopilotoService } from './copiloto.service';
import { TranscripcionService } from './transcripcion.service';
import { CopilotoController } from './copiloto.controller';

/**
 * Módulo del copiloto conversacional (chat streaming + voz). Reusa el executor
 * de tools y el Verificador del `AgentModule`; añade la persistencia del hilo
 * (Conversacion + Mensaje).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Conversacion, Mensaje]), AgentModule],
  controllers: [CopilotoController],
  providers: [ConversacionesService, CopilotoService, TranscripcionService],
  // Exportados para que el canal WhatsApp reuse el MISMO copiloto y su persistencia.
  exports: [CopilotoService, ConversacionesService, TranscripcionService],
})
export class CopilotoModule {}
