import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './config/typeorm.config';
import { validateEnv } from './config/env.validation';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { EscuelasModule } from './escuelas/escuelas.module';
import { SesionesModule } from './sesiones/sesiones.module';
import { MaterialesModule } from './materiales/materiales.module';
import { GenerationAuditModule } from './generation-audit/generation-audit.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [
    // El .env ya fue cargado por load-env (main.ts, primera línea).
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    TypeOrmModule.forRoot(dataSourceOptions),
    UsersModule,
    AuthModule,
    HealthModule,
    CurriculumModule,
    EscuelasModule,
    SesionesModule,
    MaterialesModule,
    GenerationAuditModule,
    AgentModule,
  ],
})
export class AppModule {}
