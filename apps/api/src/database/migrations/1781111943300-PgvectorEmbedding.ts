import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Habilita pgvector y agrega la columna `embedding vector(1536)` a desempeno.
 * Nullable: se puebla en Fase 2.
 *
 * Degradación elegante: si la extensión pgvector no está disponible en el
 * servidor (p.ej. una imagen de Postgres común sin pgvector, como la de
 * Coolify), la migración se omite en lugar de fallar. TypeORM corre cada
 * migración en una transacción, así que un CREATE EXTENSION fallido abortaría
 * toda la transacción y ningún try/catch la recuperaría. Por eso primero se
 * consulta pg_available_extensions (no dispara error) y sólo entonces se crea.
 */
export class PgvectorEmbedding1781111943300 implements MigrationInterface {
  name = 'PgvectorEmbedding1781111943300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS available`,
    );
    const available = rows?.[0]?.available === true || rows?.[0]?.available === 't';
    if (available) {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      await queryRunner.query(`ALTER TABLE "desempeno" ADD COLUMN "embedding" vector(1536)`);
    } else {
      // pgvector no disponible (p.ej. Postgres común en Coolify). La búsqueda
      // semántica queda deshabilitada; el resto del MVP funciona igual. Se puede
      // habilitar luego usando una imagen pgvector/pgvector y re-corriendo esta
      // migración.
      console.warn('[migration] pgvector no disponible; se omite la columna desempeno.embedding.');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "desempeno" DROP COLUMN IF EXISTS "embedding"`);
    // No se elimina la extensión: puede estar en uso por otras tablas.
  }
}
