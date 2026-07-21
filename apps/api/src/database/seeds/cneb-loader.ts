import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { Ciclo } from '@app/contracts';
import { CurriculumArea } from '../../curriculum/curriculum-area.entity';
import { Competencia } from '../../curriculum/competencia.entity';
import { Capacidad } from '../../curriculum/capacidad.entity';
import { Estandar } from '../../curriculum/estandar.entity';
import { Desempeno } from '../../curriculum/desempeno.entity';

/** Forma del JSON de entrada del CNEB (anidada). */
export interface CnebCapacidadInput {
  codigo: string;
  nombre: string;
}
export interface CnebEstandarInput {
  ciclo: string;
  descripcion: string;
}
export interface CnebDesempenoInput {
  grado: number;
  codigo?: string | null;
  descripcion: string;
}
export interface CnebCompetenciaInput {
  codigo: string;
  nombre: string;
  capacidades?: CnebCapacidadInput[];
  estandares?: CnebEstandarInput[];
  desempenos?: CnebDesempenoInput[];
}
export interface CnebAreaInput {
  area: string;
  competencias: CnebCompetenciaInput[];
}

export interface CnebLoadResult {
  areas: number;
  competencias: number;
  capacidades: number;
  estandares: number;
  desempenos: number;
  desempenosNeedsReview: number;
}

/** Directorio por defecto con los JSON del CNEB. */
export const DEFAULT_CNEB_DIR = join(__dirname, 'cneb');

function isValidCiclo(value: string): value is Ciclo {
  return (Object.values(Ciclo) as string[]).includes(value);
}

/**
 * Carga idempotente de la jerarquía curricular del CNEB.
 * - Área: clave natural = nombre.
 * - Competencia: clave natural = codigo (único).
 * - Capacidad: clave natural = (competenciaId, codigo).
 * - Estándar: clave natural = (competenciaId, ciclo).
 * - Desempeño: clave natural = (competenciaId, codigo) si hay codigo;
 *   si codigo es null, (competenciaId, grado, descripcion). codigo null =>
 *   needsReview = true (no citable por el Verificador).
 *
 * Correr dos veces NO duplica filas.
 */
export async function loadCnebFromData(
  dataSource: DataSource,
  data: CnebAreaInput[],
): Promise<CnebLoadResult> {
  const areaRepo = dataSource.getRepository(CurriculumArea);
  const competenciaRepo = dataSource.getRepository(Competencia);
  const capacidadRepo = dataSource.getRepository(Capacidad);
  const estandarRepo = dataSource.getRepository(Estandar);
  const desempenoRepo = dataSource.getRepository(Desempeno);

  const result: CnebLoadResult = {
    areas: 0,
    competencias: 0,
    capacidades: 0,
    estandares: 0,
    desempenos: 0,
    desempenosNeedsReview: 0,
  };

  for (const areaInput of data) {
    let area = await areaRepo.findOne({ where: { nombre: areaInput.area } });
    if (!area) {
      area = await areaRepo.save(areaRepo.create({ nombre: areaInput.area }));
    }
    result.areas += 1;

    for (const compInput of areaInput.competencias ?? []) {
      let competencia = await competenciaRepo.findOne({ where: { codigo: compInput.codigo } });
      if (!competencia) {
        competencia = competenciaRepo.create({
          areaId: area.id,
          codigo: compInput.codigo,
          nombre: compInput.nombre,
        });
      } else {
        competencia.areaId = area.id;
        competencia.nombre = compInput.nombre;
      }
      competencia = await competenciaRepo.save(competencia);
      result.competencias += 1;

      for (const capInput of compInput.capacidades ?? []) {
        let capacidad = await capacidadRepo.findOne({
          where: { competenciaId: competencia.id, codigo: capInput.codigo },
        });
        if (!capacidad) {
          capacidad = capacidadRepo.create({
            competenciaId: competencia.id,
            codigo: capInput.codigo,
            nombre: capInput.nombre,
          });
        } else {
          capacidad.nombre = capInput.nombre;
        }
        await capacidadRepo.save(capacidad);
        result.capacidades += 1;
      }

      for (const estInput of compInput.estandares ?? []) {
        if (!isValidCiclo(estInput.ciclo)) {
          throw new Error(
            `Ciclo inválido "${estInput.ciclo}" en competencia ${compInput.codigo} (esperado III|IV|V)`,
          );
        }
        let estandar = await estandarRepo.findOne({
          where: { competenciaId: competencia.id, ciclo: estInput.ciclo },
        });
        if (!estandar) {
          estandar = estandarRepo.create({
            competenciaId: competencia.id,
            ciclo: estInput.ciclo,
            descripcion: estInput.descripcion,
          });
        } else {
          estandar.descripcion = estInput.descripcion;
        }
        await estandarRepo.save(estandar);
        result.estandares += 1;
      }

      for (const desInput of compInput.desempenos ?? []) {
        const codigo = desInput.codigo ?? null;
        const needsReview = codigo === null;
        let desempeno = codigo
          ? await desempenoRepo.findOne({ where: { competenciaId: competencia.id, codigo } })
          : await desempenoRepo.findOne({
              where: {
                competenciaId: competencia.id,
                grado: desInput.grado,
                descripcion: desInput.descripcion,
              },
            });
        if (!desempeno) {
          desempeno = desempenoRepo.create({
            competenciaId: competencia.id,
            grado: desInput.grado,
            codigo,
            descripcion: desInput.descripcion,
            needsReview,
          });
        } else {
          desempeno.grado = desInput.grado;
          desempeno.descripcion = desInput.descripcion;
          desempeno.needsReview = needsReview;
        }
        await desempenoRepo.save(desempeno);
        result.desempenos += 1;
        if (needsReview) result.desempenosNeedsReview += 1;
      }
    }
  }

  return result;
}

/**
 * Lee todos los `*.json` de un directorio y los carga. Si el directorio no
 * existe o no tiene JSON, no hace nada (no-op) y devuelve contadores en cero.
 */
export async function loadCnebFromDir(
  dataSource: DataSource,
  dir: string = DEFAULT_CNEB_DIR,
): Promise<CnebLoadResult> {
  const empty: CnebLoadResult = {
    areas: 0,
    competencias: 0,
    capacidades: 0,
    estandares: 0,
    desempenos: 0,
    desempenosNeedsReview: 0,
  };

  if (!existsSync(dir)) {
    console.log(`[cneb] directorio no encontrado (${dir}) — nada que cargar.`);
    return empty;
  }

  const files = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.log(`[cneb] sin archivos .json en ${dir} — nada que cargar.`);
    return empty;
  }

  const totals: CnebLoadResult = { ...empty };
  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf-8');
    const parsed = JSON.parse(raw) as CnebAreaInput[];
    const res = await loadCnebFromData(dataSource, parsed);
    totals.areas += res.areas;
    totals.competencias += res.competencias;
    totals.capacidades += res.capacidades;
    totals.estandares += res.estandares;
    totals.desempenos += res.desempenos;
    totals.desempenosNeedsReview += res.desempenosNeedsReview;
    console.log(`[cneb] ${file}: ${res.competencias} competencias, ${res.desempenos} desempeños.`);
  }

  return totals;
}
