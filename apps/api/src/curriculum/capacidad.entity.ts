import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Competencia } from './competencia.entity';

@Entity('capacidad')
export class Capacidad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  competenciaId: string;

  @Column({ type: 'varchar', length: 32 })
  codigo: string;

  @Column({ type: 'varchar', length: 300 })
  nombre: string;

  @ManyToOne(() => Competencia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competenciaId' })
  competencia?: Competencia;
}
