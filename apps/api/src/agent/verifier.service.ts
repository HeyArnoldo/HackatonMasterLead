import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, IsNull, Repository } from 'typeorm';
import {
  ContenidoEvaluacion,
  contenidoEvaluacionSchema,
  ContenidoSesion,
  contenidoSesionSchema,
  MomentoNombre,
} from '@app/contracts';
import { Desempeno } from '../curriculum/desempeno.entity';

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  /** Códigos de desempeño citados que NO existen en la BD (violación #1). */
  invalidCodigos: string[];
}

export interface VerificationCtx {
  competenciaIds: string[];
  grados: number[];
}

const MOMENTOS_REQUERIDOS: MomentoNombre[] = [
  MomentoNombre.INICIO,
  MomentoNombre.DESARROLLO,
  MomentoNombre.CIERRE,
];

/**
 * Estructural: la sesión respeta la forma canónica y trae lo indispensable
 * (propósito, momentos inicio/desarrollo/cierre, evidencias).
 * Devuelve la lista de errores (vacía = OK).
 */
export function checkEstructura(contenido: ContenidoSesion): string[] {
  const errors: string[] = [];

  const parsed = contenidoSesionSchema.safeParse(contenido);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(
        `Estructura inválida en ${issue.path.map(String).join('.') || '(raíz)'}: ${issue.message}`,
      );
    }
    // Si ni siquiera parsea, el resto de chequeos no aplica.
    return errors;
  }
  const c = parsed.data;

  if (!c.propositoGeneral.trim()) {
    errors.push('Falta el propósito de aprendizaje general.');
  }
  if (c.propositosAprendizaje.length === 0) {
    errors.push('La sesión no declara ningún propósito de aprendizaje.');
  }
  for (const [i, p] of c.propositosAprendizaje.entries()) {
    if (p.desempenos.length === 0) {
      errors.push(`El propósito #${i + 1} (${p.competenciaCodigo}) no cita ningún desempeño.`);
    }
    if (!p.evidencia.trim()) {
      errors.push(
        `El propósito #${i + 1} (${p.competenciaCodigo}) no declara evidencia de aprendizaje.`,
      );
    }
  }

  const presentes = new Set(c.momentos.map((m) => m.nombre));
  for (const req of MOMENTOS_REQUERIDOS) {
    if (!presentes.has(req)) errors.push(`Falta el momento "${req}" en la secuencia didáctica.`);
  }
  for (const m of c.momentos) {
    const tieneComun = m.actividades.length > 0;
    const tienePorGrado = m.actividadesPorGrado.some((a) => a.actividades.length > 0);
    if (!tieneComun && !tienePorGrado) {
      errors.push(`El momento "${m.nombre}" no tiene actividades.`);
    }
  }

  return errors;
}

/**
 * Multigrado (diferenciador central): si se pidió más de un grado, cada grado
 * debe tener actividades diferenciadas en algún momento de la sesión.
 */
export function checkMultigrado(contenido: ContenidoSesion, grados: number[]): string[] {
  const errors: string[] = [];
  const gradosUnicos = [...new Set(grados)];
  if (gradosUnicos.length <= 1) return errors;

  const gradosConActividad = new Set<number>();
  for (const m of contenido.momentos) {
    for (const ag of m.actividadesPorGrado) {
      if (ag.actividades.length > 0) gradosConActividad.add(ag.grado);
    }
  }
  for (const g of gradosUnicos) {
    if (!gradosConActividad.has(g)) {
      errors.push(
        `Multigrado: el grado ${g} no tiene actividades diferenciadas en ningún momento.`,
      );
    }
  }
  return errors;
}

/**
 * Integridad de citas (diferenciador #1): TODO código de desempeño citado debe
 * existir en `validCodigos` (los desempeños reales de la BD para esas
 * competencias/grados). Un código inventado invalida la sesión.
 */
export function checkCitas(
  contenido: ContenidoSesion,
  validCodigos: Set<string>,
): { errors: string[]; invalidCodigos: string[] } {
  const invalid = new Set<string>();
  for (const p of contenido.propositosAprendizaje) {
    for (const d of p.desempenos) {
      if (!validCodigos.has(d.codigo)) invalid.add(d.codigo);
    }
  }
  const invalidCodigos = [...invalid];
  const errors = invalidCodigos.map(
    (codigo) =>
      `Cita inválida: el desempeño "${codigo}" no existe en el currículo para las competencias/grados de esta sesión.`,
  );
  return { errors, invalidCodigos };
}

/**
 * Integridad de citas de una EVALUACIÓN: cada `desempenoCodigo` de cada ítem
 * debe existir en `validCodigos`. Reusa la MISMA disciplina de citas que las
 * sesiones (un código inventado invalida el examen).
 */
export function checkCitasEvaluacion(
  contenido: ContenidoEvaluacion,
  validCodigos: Set<string>,
): { errors: string[]; invalidCodigos: string[] } {
  const invalid = new Set<string>();
  for (const item of contenido.items) {
    if (!validCodigos.has(item.desempenoCodigo)) invalid.add(item.desempenoCodigo);
  }
  const invalidCodigos = [...invalid];
  const errors = invalidCodigos.map(
    (codigo) =>
      `Cita inválida: el desempeño "${codigo}" no existe en el currículo para las competencias/grado de esta evaluación.`,
  );
  return { errors, invalidCodigos };
}

/**
 * Verificador (patrón Critic): valida el `contenidoJson` producido por la IA
 * ANTES de devolverlo/guardarlo. Garantiza que la sesión solo cite desempeños
 * REALES del currículo.
 */
@Injectable()
export class VerifierService {
  constructor(@InjectRepository(Desempeno) private readonly desempenos: Repository<Desempeno>) {}

  /** Códigos de desempeño citables (reales) para esas competencias/grados. */
  async loadValidCodigos(ctx: VerificationCtx): Promise<Set<string>> {
    if (!ctx.competenciaIds.length || !ctx.grados.length) return new Set();
    const rows = await this.desempenos.find({
      where: {
        competenciaId: In(ctx.competenciaIds),
        grado: In(ctx.grados),
        needsReview: false,
        codigo: Not(IsNull()),
      },
      select: { codigo: true },
    });
    return new Set(rows.map((r) => r.codigo).filter((c): c is string => c !== null));
  }

  async verify(contenido: ContenidoSesion, ctx: VerificationCtx): Promise<VerificationResult> {
    const errors: string[] = [];

    const estructura = checkEstructura(contenido);
    errors.push(...estructura);

    // Si la estructura no parsea, no seguimos con chequeos que asumen la forma.
    if (estructura.length > 0 && !contenidoSesionSchema.safeParse(contenido).success) {
      return { valid: false, errors, invalidCodigos: [] };
    }

    errors.push(...checkMultigrado(contenido, ctx.grados));

    const validCodigos = await this.loadValidCodigos(ctx);
    const citas = checkCitas(contenido, validCodigos);
    errors.push(...citas.errors);

    return { valid: errors.length === 0, errors, invalidCodigos: citas.invalidCodigos };
  }

  /**
   * Verifica una EVALUACIÓN: estructura (schema) + integridad de citas de los
   * ítems. Reusa `loadValidCodigos` (la misma consulta citable de las sesiones),
   * garantizando que el examen no invente desempeños.
   */
  async verifyEvaluacion(
    contenido: ContenidoEvaluacion,
    ctx: VerificationCtx,
  ): Promise<VerificationResult> {
    const parsed = contenidoEvaluacionSchema.safeParse(contenido);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(
        (issue) =>
          `Estructura inválida en ${issue.path.map(String).join('.') || '(raíz)'}: ${issue.message}`,
      );
      return { valid: false, errors, invalidCodigos: [] };
    }

    const validCodigos = await this.loadValidCodigos(ctx);
    const citas = checkCitasEvaluacion(parsed.data, validCodigos);
    return {
      valid: citas.errors.length === 0,
      errors: citas.errors,
      invalidCodigos: citas.invalidCodigos,
    };
  }
}
