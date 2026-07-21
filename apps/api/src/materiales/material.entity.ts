import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TipoMaterial } from '@app/contracts';
import { SesionAprendizaje } from '../sesiones/sesion-aprendizaje.entity';

@Entity('material')
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sesionId: string;

  @Column({ type: 'enum', enum: TipoMaterial })
  tipo: TipoMaterial;

  @Column({ type: 'varchar', length: 80 })
  lengua: string;

  @Column({ type: 'jsonb' })
  contenido: unknown;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => SesionAprendizaje, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sesionId' })
  sesion?: SesionAprendizaje;
}
