import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { GenerationAuditModule } from '../generation-audit/generation-audit.module';
import { SesionAprendizaje } from '../sesiones/sesion-aprendizaje.entity';
import { AgentToolExecutorService } from './agent-tool-executor.service';
import { VerifierService } from './verifier.service';
import { SesionGeneratorService } from './agent.service';

/**
 * Módulo del agente generador de sesiones. Reúne las tools de currículo, el
 * Verificador (integridad de citas) y el orquestador del tool loop (OpenAI).
 * Registra su propio repo de SesionAprendizaje (evita ciclo con SesionesModule).
 */
@Module({
  imports: [CurriculumModule, GenerationAuditModule, TypeOrmModule.forFeature([SesionAprendizaje])],
  providers: [AgentToolExecutorService, VerifierService, SesionGeneratorService],
  exports: [SesionGeneratorService, VerifierService, AgentToolExecutorService],
})
export class AgentModule {}
