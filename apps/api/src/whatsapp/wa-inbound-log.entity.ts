import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Log de webhooks entrantes de Evolution. La PK por `waMessageId` hace el
 * procesamiento idempotente: un reintento del webhook no reprocesa el mensaje
 * (el copiloto no responde dos veces al mismo audio/texto).
 */
@Entity('wa_inbound_log')
export class WaInboundLog {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  waMessageId: string;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  processedAt: Date;
}
