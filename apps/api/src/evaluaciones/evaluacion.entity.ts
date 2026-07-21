import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoEvaluacion } from '@app/contracts';
import { User } from '../users/user.entity';
import { CurriculumArea } from '../curriculum/curriculum-area.entity';
import { GenerationAudit } from '../generation-audit/generation-audit.entity';

/**
 * Evaluación/examen generado por el copiloto. Hermano de `SesionAprendizaje`:
 * es un artefacto STANDALONE sobre un tema (no cuelga de una sesión), por eso
 * NO reusa `Material` (que exige `sesionId`). Cada ítem cita un desempeño real
 * del CNEB (Verificador), igual que las sesiones.
 */
@Entity('evaluacion')
export class Evaluacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  docenteId: string;

  @Column({ type: 'int' })
  grado: number;

  @Column({ type: 'uuid', nullable: true })
  areaId: string | null;

  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  competenciaIds: string[];

  @Column({ type: 'jsonb', nullable: true })
  contenidoJson: unknown;

  @Column({ type: 'enum', enum: EstadoEvaluacion, default: EstadoEvaluacion.BORRADOR })
  estado: EstadoEvaluacion;

  @Column({ type: 'uuid', nullable: true })
  generationAuditId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'docenteId' })
  docente?: User;

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
