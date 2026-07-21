import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Canal WhatsApp: identidad simple del docente por número (`users.phone`) y log
 * de idempotencia de webhooks entrantes de Evolution (`wa_inbound_log`, PK por
 * `waMessageId` para que los reintentos no reprocesen un mensaje).
 */
export class WhatsappChannel1781111943500 implements MigrationInterface {
  name = 'WhatsappChannel1781111943500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "phone" character varying(32)`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_phone" UNIQUE ("phone")`);

    await queryRunner.query(
      `CREATE TABLE "wa_inbound_log" ("waMessageId" character varying(120) NOT NULL, "payload" jsonb NOT NULL, "processedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_wa_inbound_log" PRIMARY KEY ("waMessageId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "wa_inbound_log"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_phone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
  }
}
