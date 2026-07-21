import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Rastro de auditoría de cada generación de IA (prompt, contexto, modelo, tokens). */
@Entity('generation_audit')
export class GenerationAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'jsonb', nullable: true })
  contextoUsado: unknown;

  @Column({ type: 'varchar', length: 64, nullable: true })
  versionCurriculo: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  modelo: string | null;

  @Column({ type: 'int', default: 0 })
  tokens: number;

  @CreateDateColumn()
  createdAt: Date;
}
