import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dominio Yachai: jerarquía curricular CNEB (relacional, no RAG-chunked),
 * escuelas, sesiones de aprendizaje, materiales y auditoría de generación.
 * La columna `embedding` de desempeno la agrega la migración PgvectorEmbedding.
 */
export class CurriculumAndSesiones1781111943200 implements MigrationInterface {
  name = 'CurriculumAndSesiones1781111943200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Enums ---
    await queryRunner.query(`CREATE TYPE "public"."estandar_ciclo_enum" AS ENUM('III', 'IV', 'V')`);
    await queryRunner.query(
      `CREATE TYPE "public"."sesion_aprendizaje_estado_enum" AS ENUM('borrador', 'final')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."material_tipo_enum" AS ENUM('fichaEstudiante', 'guiaDocente', 'audioGuion')`,
    );

    // --- Jerarquía curricular ---
    await queryRunner.query(
      `CREATE TABLE "curriculum_area" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(160) NOT NULL, CONSTRAINT "UQ_curriculum_area_nombre" UNIQUE ("nombre"), CONSTRAINT "PK_curriculum_area" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "competencia" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "areaId" uuid NOT NULL, "codigo" character varying(32) NOT NULL, "nombre" character varying(300) NOT NULL, CONSTRAINT "UQ_competencia_codigo" UNIQUE ("codigo"), CONSTRAINT "PK_competencia" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "capacidad" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "competenciaId" uuid NOT NULL, "codigo" character varying(32) NOT NULL, "nombre" character varying(300) NOT NULL, CONSTRAINT "PK_capacidad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "estandar" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "competenciaId" uuid NOT NULL, "ciclo" "public"."estandar_ciclo_enum" NOT NULL, "descripcion" text NOT NULL, CONSTRAINT "PK_estandar" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "desempeno" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "competenciaId" uuid NOT NULL, "grado" integer NOT NULL, "codigo" character varying(32), "descripcion" text NOT NULL, "needsReview" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_desempeno" PRIMARY KEY ("id"))`,
    );

    // --- Escuela ---
    await queryRunner.query(
      `CREATE TABLE "escuela" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(200) NOT NULL, "ugel" character varying(120) NOT NULL, "esUnidocente" boolean NOT NULL DEFAULT false, "esMultigrado" boolean NOT NULL DEFAULT false, "lenguas" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_escuela" PRIMARY KEY ("id"))`,
    );

    // --- Auditoría de generación ---
    await queryRunner.query(
      `CREATE TABLE "generation_audit" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "prompt" text NOT NULL, "contextoUsado" jsonb, "versionCurriculo" character varying(64), "modelo" character varying(120), "tokens" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_generation_audit" PRIMARY KEY ("id"))`,
    );

    // --- Sesión de aprendizaje ---
    await queryRunner.query(
      `CREATE TABLE "sesion_aprendizaje" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "docenteId" uuid NOT NULL, "escuelaId" uuid, "grados" integer array NOT NULL DEFAULT '{}', "areaId" uuid, "competenciaIds" uuid array NOT NULL DEFAULT '{}', "lengua" character varying(80) NOT NULL, "contexto" text, "contenidoJson" jsonb, "estado" "public"."sesion_aprendizaje_estado_enum" NOT NULL DEFAULT 'borrador', "generationAuditId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_sesion_aprendizaje" PRIMARY KEY ("id"))`,
    );

    // --- Material ---
    await queryRunner.query(
      `CREATE TABLE "material" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sesionId" uuid NOT NULL, "tipo" "public"."material_tipo_enum" NOT NULL, "lengua" character varying(80) NOT NULL, "contenido" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_material" PRIMARY KEY ("id"))`,
    );

    // --- Claves foráneas ---
    await queryRunner.query(
      `ALTER TABLE "competencia" ADD CONSTRAINT "FK_competencia_area" FOREIGN KEY ("areaId") REFERENCES "curriculum_area"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "capacidad" ADD CONSTRAINT "FK_capacidad_competencia" FOREIGN KEY ("competenciaId") REFERENCES "competencia"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "estandar" ADD CONSTRAINT "FK_estandar_competencia" FOREIGN KEY ("competenciaId") REFERENCES "competencia"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "desempeno" ADD CONSTRAINT "FK_desempeno_competencia" FOREIGN KEY ("competenciaId") REFERENCES "competencia"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesion_aprendizaje" ADD CONSTRAINT "FK_sesion_docente" FOREIGN KEY ("docenteId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesion_aprendizaje" ADD CONSTRAINT "FK_sesion_escuela" FOREIGN KEY ("escuelaId") REFERENCES "escuela"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesion_aprendizaje" ADD CONSTRAINT "FK_sesion_area" FOREIGN KEY ("areaId") REFERENCES "curriculum_area"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesion_aprendizaje" ADD CONSTRAINT "FK_sesion_generation_audit" FOREIGN KEY ("generationAuditId") REFERENCES "generation_audit"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material" ADD CONSTRAINT "FK_material_sesion" FOREIGN KEY ("sesionId") REFERENCES "sesion_aprendizaje"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "material" DROP CONSTRAINT "FK_material_sesion"`);
    await queryRunner.query(
      `ALTER TABLE "sesion_aprendizaje" DROP CONSTRAINT "FK_sesion_generation_audit"`,
    );
    await queryRunner.query(`ALTER TABLE "sesion_aprendizaje" DROP CONSTRAINT "FK_sesion_area"`);
    await queryRunner.query(`ALTER TABLE "sesion_aprendizaje" DROP CONSTRAINT "FK_sesion_escuela"`);
    await queryRunner.query(`ALTER TABLE "sesion_aprendizaje" DROP CONSTRAINT "FK_sesion_docente"`);
    await queryRunner.query(`ALTER TABLE "desempeno" DROP CONSTRAINT "FK_desempeno_competencia"`);
    await queryRunner.query(`ALTER TABLE "estandar" DROP CONSTRAINT "FK_estandar_competencia"`);
    await queryRunner.query(`ALTER TABLE "capacidad" DROP CONSTRAINT "FK_capacidad_competencia"`);
    await queryRunner.query(`ALTER TABLE "competencia" DROP CONSTRAINT "FK_competencia_area"`);

    await queryRunner.query(`DROP TABLE "material"`);
    await queryRunner.query(`DROP TABLE "sesion_aprendizaje"`);
    await queryRunner.query(`DROP TABLE "generation_audit"`);
    await queryRunner.query(`DROP TABLE "escuela"`);
    await queryRunner.query(`DROP TABLE "desempeno"`);
    await queryRunner.query(`DROP TABLE "estandar"`);
    await queryRunner.query(`DROP TABLE "capacidad"`);
    await queryRunner.query(`DROP TABLE "competencia"`);
    await queryRunner.query(`DROP TABLE "curriculum_area"`);

    await queryRunner.query(`DROP TYPE "public"."material_tipo_enum"`);
    await queryRunner.query(`DROP TYPE "public"."sesion_aprendizaje_estado_enum"`);
    await queryRunner.query(`DROP TYPE "public"."estandar_ciclo_enum"`);
  }
}
