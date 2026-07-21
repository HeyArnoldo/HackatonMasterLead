import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('escuela')
export class Escuela {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'varchar', length: 120 })
  ugel: string;

  @Column({ type: 'boolean', default: false })
  esUnidocente: boolean;

  @Column({ type: 'boolean', default: false })
  esMultigrado: boolean;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  lenguas: string[];
}
