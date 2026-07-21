import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evaluacion } from './evaluacion.entity';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
import { AgentModule } from '../agent/agent.module';
import { PdfModule } from '../pdf/pdf.module';

/**
 * Módulo de evaluaciones/exámenes. Reusa el generador (Verificador-gated) del
 * `AgentModule` y el `PdfModule` para el export. Registra su propio repo de
 * `Evaluacion` para las lecturas.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Evaluacion]), AgentModule, PdfModule],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService],
  exports: [TypeOrmModule],
})
export class EvaluacionesModule {}
