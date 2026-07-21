import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Ciclo } from '@app/contracts';
import { Competencia } from './competencia.entity';

@Entity('estandar')
export class Estandar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  competenciaId: string;

  @Column({ type: 'enum', enum: Ciclo })
  ciclo: Ciclo;

  @Column({ type: 'text' })
  descripcion: string;

  @ManyToOne(() => Competencia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competenciaId' })
  competencia?: Competencia;
}
