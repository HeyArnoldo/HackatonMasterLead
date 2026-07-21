import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Competencia } from './competencia.entity';

/**
 * Desempeño: fila que el Verificador cita al validar una sesión.
 *
 * La columna `embedding vector(1536)` existe en la base (la agrega la migración
 * PgvectorEmbedding) pero NO se mapea aquí: TypeORM 0.3 no conoce el tipo
 * `vector` de pgvector y `synchronize` está en false. Se puebla en Fase 2 vía
 * SQL crudo, así que mantenerla fuera de la entidad evita drift de esquema.
 */
@Entity('desempeno')
export class Desempeno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  competenciaId: string;

  @Column({ type: 'int' })
  grado: number;

  /** null => requiere revisión; el Verificador no debe citarlo. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  codigo: string | null;

  @Column({ type: 'text' })
  descripcion: string;

  /** Derivado en la carga: true cuando `codigo` es null (no citable). */
  @Column({ type: 'boolean', default: false })
  needsReview: boolean;

  @ManyToOne(() => Competencia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competenciaId' })
  competencia?: Competencia;
}
