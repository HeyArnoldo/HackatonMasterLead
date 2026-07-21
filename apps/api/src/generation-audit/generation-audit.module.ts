import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationAudit } from './generation-audit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GenerationAudit])],
  exports: [TypeOrmModule],
})
export class GenerationAuditModule {}
