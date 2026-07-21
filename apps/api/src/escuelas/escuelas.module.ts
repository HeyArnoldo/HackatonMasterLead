import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escuela } from './escuela.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Escuela])],
  exports: [TypeOrmModule],
})
export class EscuelasModule {}
