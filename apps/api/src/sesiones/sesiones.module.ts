import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SesionAprendizaje } from './sesion-aprendizaje.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SesionAprendizaje])],
  exports: [TypeOrmModule],
})
export class SesionesModule {}
