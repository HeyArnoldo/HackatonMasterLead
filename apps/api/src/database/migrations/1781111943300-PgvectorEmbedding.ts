import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Habilita pgvector y agrega la columna `embedding vector(1536)` a desempeno.
 * Nullable: se puebla en Fase 2. CREATE EXTENSION IF NOT EXISTS es idempotente
 * y no falla si la extensión ya existe.
 */
export class PgvectorEmbedding1781111943300 implements MigrationInterface {
  name = 'PgvectorEmbedding1781111943300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`ALTER TABLE "desempeno" ADD COLUMN "embedding" vector(1536)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "desempeno" DROP COLUMN "embedding"`);
    // No se elimina la extensión: puede estar en uso por otras tablas.
  }
}
