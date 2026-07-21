import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persistencia del copiloto conversacional: hilos (`conversacion`) y mensajes
 * (`mensaje`) para poder reanudar un chat. Espeja las entidades de chat de
 * mayordomo, adaptadas al dominio Yachai (el hilo pertenece a un docente).
 */
export class CopilotoChat1781111943400 implements MigrationInterface {
  name = 'CopilotoChat1781111943400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."mensaje_rol_enum" AS ENUM('user', 'assistant')`);

    await queryRunner.query(
      `CREATE TABLE "conversacion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "docenteId" uuid NOT NULL, "titulo" character varying(160) NOT NULL DEFAULT 'Nueva conversación', "lastAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_conversacion" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversacion_docente_lastAt" ON "conversacion" ("docenteId", "lastAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE "mensaje" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversacionId" uuid NOT NULL, "rol" "public"."mensaje_rol_enum" NOT NULL, "contenido" text NOT NULL, "toolCalls" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_mensaje" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mensaje_conversacion_createdAt" ON "mensaje" ("conversacionId", "createdAt")`,
    );

    await queryRunner.query(
      `ALTER TABLE "conversacion" ADD CONSTRAINT "FK_conversacion_docente" FOREIGN KEY ("docenteId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mensaje" ADD CONSTRAINT "FK_mensaje_conversacion" FOREIGN KEY ("conversacionId") REFERENCES "conversacion"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "mensaje" DROP CONSTRAINT "FK_mensaje_conversacion"`);
    await queryRunner.query(`ALTER TABLE "conversacion" DROP CONSTRAINT "FK_conversacion_docente"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mensaje_conversacion_createdAt"`);
    await queryRunner.query(`DROP TABLE "mensaje"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_conversacion_docente_lastAt"`);
    await queryRunner.query(`DROP TABLE "conversacion"`);
    await queryRunner.query(`DROP TYPE "public"."mensaje_rol_enum"`);
  }
}
