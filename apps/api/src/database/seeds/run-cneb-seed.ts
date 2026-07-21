import '../../config/load-env';
import dataSource from '../../config/typeorm.config';
import { DEFAULT_CNEB_DIR, loadCnebFromDir } from './cneb-loader';

/**
 * Carga idempotente del CNEB desde `src/database/seeds/cneb/*.json`.
 * Uso: pnpm --filter @app/api seed:cneb
 */
async function run(): Promise<void> {
  await dataSource.initialize();
  try {
    const totals = await loadCnebFromDir(dataSource, DEFAULT_CNEB_DIR);
    console.log(
      `[cneb] listo — áreas:${totals.areas} competencias:${totals.competencias} ` +
        `capacidades:${totals.capacidades} estándares:${totals.estandares} ` +
        `desempeños:${totals.desempenos} (revisar:${totals.desempenosNeedsReview})`,
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error('[cneb] error:', err);
  process.exit(1);
});
