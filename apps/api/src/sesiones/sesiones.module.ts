import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SesionAprendizaje } from './sesion-aprendizaje.entity';
import { SesionesController } from './sesiones.controller';
import { SesionesService } from './sesiones.service';
import { AgentModule } from '../agent/agent.module';
import { CurriculumModule } from '../curriculum/curriculum.module';

@Module({
  imports: [TypeOrmModule.forFeature([SesionAprendizaje]), AgentModule, CurriculumModule],
  controllers: [SesionesController],
  providers: [SesionesService],
  exports: [TypeOrmModule],
})
export class SesionesModule {}
