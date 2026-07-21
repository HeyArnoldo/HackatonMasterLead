import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RolMensaje } from '@app/contracts';
import { Conversacion } from './conversacion.entity';

/**
 * Un mensaje del hilo del copiloto. El orden es puramente por `createdAt`
 * (no hay columna de orden). `toolCalls` guarda las llamadas a tools del turno
 * del asistente (rastro de la construcción de la sesión).
 */
@Entity('mensaje')
@Index(['conversacionId', 'createdAt'])
export class Mensaje {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversacionId: string;

  @ManyToOne(() => Conversacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversacionId' })
  conversacion?: Conversacion;

  @Column({ type: 'enum', enum: RolMensaje })
  rol: RolMensaje;

  @Column({ type: 'text' })
  contenido: string;

  @Column({ type: 'jsonb', nullable: true })
  toolCalls: unknown | null;

  @CreateDateColumn()
  createdAt: Date;
}
