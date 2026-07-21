import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { CopilotoModule } from '../copiloto/copiloto.module';
import { WaInboundLog } from './wa-inbound-log.entity';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionClient } from './evolution.client';

/**
 * Canal WhatsApp del copiloto (Evolution API). Reusa el copiloto conversacional
 * y su persistencia (`CopilotoModule`) y la identidad de docentes (`UsersModule`);
 * añade solo el cliente de Evolution y el log de idempotencia.
 */
@Module({
  imports: [TypeOrmModule.forFeature([WaInboundLog]), UsersModule, CopilotoModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, EvolutionClient],
})
export class WhatsappModule {}
