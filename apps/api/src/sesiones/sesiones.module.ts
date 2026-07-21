import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SesionAprendizaje } from './sesion-aprendizaje.entity';
import { SesionesController } from './sesiones.controller';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [TypeOrmModule.forFeature([SesionAprendizaje]), AgentModule],
  controllers: [SesionesController],
  exports: [TypeOrmModule],
})
export class SesionesModule {}
