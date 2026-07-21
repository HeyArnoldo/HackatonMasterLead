import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../config/typeorm.config';
import { CurriculumArea } from '../../curriculum/curriculum-area.entity';
import { Competencia } from '../../curriculum/competencia.entity';
import { Capacidad } from '../../curriculum/capacidad.entity';
import { Estandar } from '../../curriculum/estandar.entity';
import { Desempeno } from '../../curriculum/desempeno.entity';
import { CnebAreaInput, DEFAULT_CNEB_DIR, loadCnebFromData, loadCnebFromDir } from './cneb-loader';

/**
 * Prueba de integración: requiere Postgres (pgvector) arriba.
 * Se corre aparte del `jest` por defecto (script: pnpm --filter @app/api test:db)
 * porque el CI no levanta base de datos.
 */
describe('CNEB loader (idempotencia)', () => {
  let dataSource: DataSource;

  async function counts() {
    return {
      areas: await dataSource.getRepository(CurriculumArea).count(),
      competencias: await dataSource.getRepository(Competencia).count(),
      capacidades: await dataSource.getRepository(Capacidad).count(),
      estandares: await dataSource.getRepository(Estandar).count(),
      desempenos: await dataSource.getRepository(Desempeno).count(),
    };
  }

  beforeAll(async () => {
    dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
    await dataSource.runMigrations();
    // Aislar: limpiar la jerarquía curricular antes de la prueba.
    await dataSource.query(
      'TRUNCATE TABLE "desempeno", "estandar", "capacidad", "competencia", "curriculum_area" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('cargar dos veces no duplica filas', async () => {
    const first = await loadCnebFromDir(dataSource, DEFAULT_CNEB_DIR);
    const afterFirst = await counts();

    await loadCnebFromDir(dataSource, DEFAULT_CNEB_DIR);
    const afterSecond = await counts();

    // El fixture sample.json aporta contenido real.
    expect(first.competencias).toBeGreaterThanOrEqual(2);
    expect(afterFirst.competencias).toBeGreaterThanOrEqual(2);

    // Idempotencia: mismos conteos tras la segunda corrida.
    expect(afterSecond).toEqual(afterFirst);
  });

  it('marca needsReview los desempeños con codigo null', async () => {
    // Auto-contenida: NO depende del seed real (que no trae filas needs-review).
    // Carga un fixture mínimo con un desempeño de codigo:null y verifica que se
    // marque como needsReview (no citable por el Verificador).
    const fixture: CnebAreaInput[] = [
      {
        area: 'Área de prueba needsReview',
        competencias: [
          {
            codigo: 'TEST-NR-C1',
            nombre: 'Competencia de prueba',
            desempenos: [
              { grado: 1, codigo: null, descripcion: 'Desempeño sin código (requiere revisión)' },
            ],
          },
        ],
      },
    ];

    const res = await loadCnebFromData(dataSource, fixture);
    expect(res.desempenosNeedsReview).toBeGreaterThanOrEqual(1);

    const repo = dataSource.getRepository(Desempeno);
    const sinCodigo = await repo.count({ where: { needsReview: true } });
    expect(sinCodigo).toBeGreaterThanOrEqual(1);
  });
});
