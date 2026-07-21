import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Evaluación/examen (Fase 4-a): artefacto standalone generado por el copiloto,
 * hermano de `sesion_aprendizaje`. Cada evaluación queda anclada al docente,
 * al área y a las competencias, con su `contenidoJson` (ítems que citan
 * desempeños reales) y su auditoría de generación.
 */
export class Evaluacion1781111943600 implements MigrationInterface {
  name = 'Evaluacion1781111943600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."evaluacion_estado_enum" AS ENUM('borrador', 'final')`,
    );
    await queryRunner.query(
      `CREATE TABLE "evaluacion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "docenteId" uuid NOT NULL, "grado" integer NOT NULL, "areaId" uuid, "competenciaIds" uuid array NOT NULL DEFAULT '{}', "contenidoJson" jsonb, "estado" "public"."evaluacion_estado_enum" NOT NULL DEFAULT 'borrador', "generationAuditId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_evaluacion" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluacion" ADD CONSTRAINT "FK_evaluacion_docente" FOREIGN KEY ("docenteId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluacion" ADD CONSTRAINT "FK_evaluacion_area" FOREIGN KEY ("areaId") REFERENCES "curriculum_area"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluacion" ADD CONSTRAINT "FK_evaluacion_audit" FOREIGN KEY ("generationAuditId") REFERENCES "generation_audit"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "evaluacion" DROP CONSTRAINT "FK_evaluacion_audit"`);
    await queryRunner.query(`ALTER TABLE "evaluacion" DROP CONSTRAINT "FK_evaluacion_area"`);
    await queryRunner.query(`ALTER TABLE "evaluacion" DROP CONSTRAINT "FK_evaluacion_docente"`);
    await queryRunner.query(`DROP TABLE "evaluacion"`);
    await queryRunner.query(`DROP TYPE "public"."evaluacion_estado_enum"`);
  }
}
