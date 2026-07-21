import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumArea } from './curriculum-area.entity';
import { Competencia } from './competencia.entity';
import { Capacidad } from './capacidad.entity';
import { Estandar } from './estandar.entity';
import { Desempeno } from './desempeno.entity';
import { CurriculumService } from './curriculum.service';
import { CurriculumController } from './curriculum.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CurriculumArea, Competencia, Capacidad, Estandar, Desempeno]),
  ],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [TypeOrmModule, CurriculumService],
})
export class CurriculumModule {}
