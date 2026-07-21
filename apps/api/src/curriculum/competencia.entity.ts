import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CurriculumArea } from './curriculum-area.entity';

@Entity('competencia')
export class Competencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  areaId: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 300 })
  nombre: string;

  @ManyToOne(() => CurriculumArea, (area) => area.competencias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'areaId' })
  area?: CurriculumArea;
}
