import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Competencia } from './competencia.entity';

@Entity('curriculum_area')
export class CurriculumArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  nombre: string;

  @OneToMany(() => Competencia, (competencia) => competencia.area)
  competencias?: Competencia[];
}
