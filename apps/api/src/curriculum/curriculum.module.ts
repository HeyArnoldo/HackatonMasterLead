import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumArea } from './curriculum-area.entity';
import { Competencia } from './competencia.entity';
import { Capacidad } from './capacidad.entity';
import { Estandar } from './estandar.entity';
import { Desempeno } from './desempeno.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CurriculumArea, Competencia, Capacidad, Estandar, Desempeno]),
  ],
  exports: [TypeOrmModule],
})
export class CurriculumModule {}
