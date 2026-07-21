import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Conversación del copiloto conversacional (chat que construye una sesión).
 * Espeja la entidad `conversations` de mayordomo, adaptada al dominio Yachai:
 * pertenece a un docente y guarda el hilo de mensajes para poder reanudar.
 */
@Entity('conversacion')
@Index(['docenteId', 'lastAt'])
export class Conversacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  docenteId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'docenteId' })
  docente?: User;

  @Column({ type: 'varchar', length: 160, default: 'Nueva conversación' })
  titulo: string;

  /** Última actividad del hilo (para ordenar la lista de conversaciones). */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
