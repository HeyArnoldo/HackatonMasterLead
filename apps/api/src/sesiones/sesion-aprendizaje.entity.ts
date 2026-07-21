import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoSesion } from '@app/contracts';
import { User } from '../users/user.entity';
import { Escuela } from '../escuelas/escuela.entity';
import { CurriculumArea } from '../curriculum/curriculum-area.entity';
import { GenerationAudit } from '../generation-audit/generation-audit.entity';

@Entity('sesion_aprendizaje')
export class SesionAprendizaje {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  docenteId: string;

  @Column({ type: 'uuid', nullable: true })
  escuelaId: string | null;

  @Column({ type: 'int', array: true, default: () => "'{}'" })
  grados: number[];

  @Column({ type: 'uuid', nullable: true })
  areaId: string | null;

  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  competenciaIds: string[];

  @Column({ type: 'varchar', length: 80 })
  lengua: string;

  @Column({ type: 'text', nullable: true })
  contexto: string | null;

  @Column({ type: 'jsonb', nullable: true })
  contenidoJson: unknown;

  @Column({ type: 'enum', enum: EstadoSesion, default: EstadoSesion.BORRADOR })
  estado: EstadoSesion;

  @Column({ type: 'uuid', nullable: true })
  generationAuditId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'docenteId' })
  docente?: User;

  @ManyToOne(() => Escuela, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'escuelaId' })
  escuela?: Escuela | null;

  @ManyToOne(() => CurriculumArea, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'areaId' })
  area?: CurriculumArea | null;

  @ManyToOne(() => GenerationAudit, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'generationAuditId' })
  generationAudit?: GenerationAudit | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
