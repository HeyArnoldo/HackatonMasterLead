import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EstadoEvaluacion, EstadoSesion } from '@app/contracts';
import { CurriculumArea } from '../curriculum/curriculum-area.entity';
import { Evaluacion } from '../evaluaciones/evaluacion.entity';
import { Competencia } from '../curriculum/competencia.entity';
import { Capacidad } from '../curriculum/capacidad.entity';
import { Estandar } from '../curriculum/estandar.entity';
import { Desempeno } from '../curriculum/desempeno.entity';
import { SesionAprendizaje } from '../sesiones/sesion-aprendizaje.entity';
import { GenerationAudit } from '../generation-audit/generation-audit.entity';

/** Resultado de una llamada a tool, para el rastro de auditoría (contextoUsado). */
export interface ToolCallRecord {
  tool: string;
  args: unknown;
  result: unknown;
  at: string;
}

/** Acumula las llamadas a tools de una generación → GenerationAudit.contextoUsado. */
export class ToolAuditCollector {
  private readonly records: ToolCallRecord[] = [];

  record(tool: string, args: unknown, result: unknown): void {
    this.records.push({ tool, args, result, at: new Date().toISOString() });
  }

  all(): ToolCallRecord[] {
    return this.records;
  }
}

export interface BuscarCurriculoArgs {
  area: string;
  competenciaIds?: string[];
}

export interface ObtenerDesempenosArgs {
  competenciaIds: string[];
  grados: number[];
}

export interface BuscarRecursosContextoArgs {
  contexto?: string;
  lengua?: string;
}

export interface GuardarSesionInput {
  docenteId: string;
  escuelaId?: string | null;
  areaId: string | null;
  grados: number[];
  competenciaIds: string[];
  lengua: string;
  contexto?: string | null;
  contenidoJson: unknown;
  audit: {
    prompt: string;
    contextoUsado: unknown;
    versionCurriculo?: string | null;
    modelo?: string | null;
    tokens?: number;
  };
}

export interface GuardarEvaluacionInput {
  docenteId: string;
  areaId: string | null;
  grado: number;
  competenciaIds: string[];
  contenidoJson: unknown;
  audit: {
    prompt: string;
    contextoUsado: unknown;
    versionCurriculo?: string | null;
    modelo?: string | null;
    tokens?: number;
  };
}

/**
 * Contexto curado (MVP): pistas de contextualización amazónica y notas de
 * lengua originaria. Sin llamadas externas — es un helper liviano.
 */
const CONTEXTO_AMAZONICO: string[] = [
  'Parte de saberes de la comunidad: chacra, río, bosque, pesca, caza y recolección como situaciones significativas.',
  'Usa recursos del entorno (semillas, hojas, arcilla, frutos) como material concreto y manipulable.',
  'Incorpora relatos, mitos y prácticas de los pueblos originarios amazónicos con respeto intercultural.',
  'Reconoce el calendario comunal y las actividades productivas locales (siembra, cosecha, festividades).',
];

const NOTAS_LENGUA: Record<string, string> = {
  castellano:
    'Castellano como segunda lengua en contexto EIB: apoya con vocabulario visual y permite que el estudiante piense primero en su lengua materna.',
  awajun:
    'Awajún (lengua originaria): valida el uso de la lengua materna en la oralidad; introduce términos técnicos en castellano de forma gradual y contrastiva.',
  shipibo:
    'Shipibo-konibo (lengua originaria): apóyate en los diseños (kené) y la tradición oral; alterna lengua materna y castellano según el propósito.',
  quechua:
    'Quechua (lengua originaria): recupera saberes andino-amazónicos y usa la lengua materna para la comprensión de conceptos nuevos.',
};

/**
 * Ejecuta las tools del generador de sesiones. TODAS resuelven datos reales de
 * las tablas de currículo/escuela: la IA solo puede citar lo que estas tools
 * devuelven. GUARDRAIL clave: los desempeños citables tienen `codigo` no nulo y
 * `needsReview=false` (verdad citable).
 */
@Injectable()
export class AgentToolExecutorService {
  private readonly logger = new Logger(AgentToolExecutorService.name);

  constructor(
    @InjectRepository(CurriculumArea) private readonly areas: Repository<CurriculumArea>,
    @InjectRepository(Competencia) private readonly competencias: Repository<Competencia>,
    @InjectRepository(Capacidad) private readonly capacidades: Repository<Capacidad>,
    @InjectRepository(Estandar) private readonly estandares: Repository<Estandar>,
    @InjectRepository(Desempeno) private readonly desempenos: Repository<Desempeno>,
    @InjectRepository(SesionAprendizaje) private readonly sesiones: Repository<SesionAprendizaje>,
    @InjectRepository(Evaluacion) private readonly evaluaciones: Repository<Evaluacion>,
    @InjectRepository(GenerationAudit) private readonly audits: Repository<GenerationAudit>,
  ) {}

  /** Resuelve un área por nombre (case-insensitive). null si no existe. */
  async resolveArea(area: string): Promise<CurriculumArea | null> {
    const found = await this.areas
      .createQueryBuilder('a')
      .where('LOWER(a.nombre) = LOWER(:nombre)', { nombre: area.trim() })
      .getOne();
    return found ?? null;
  }

  /** IDs de todas las competencias de un área (ámbito de verificación por defecto). */
  async competenciaIdsDeArea(areaId: string): Promise<string[]> {
    const comps = await this.competencias.find({ where: { areaId }, select: { id: true } });
    return comps.map((c) => c.id);
  }

  /**
   * buscar_curriculo → competencias + capacidades + estándares (por ciclo) del
   * área/selección. Contexto para que la IA elija competencias válidas.
   */
  async buscarCurriculo(args: BuscarCurriculoArgs): Promise<unknown> {
    const area = await this.resolveArea(args.area);
    if (!area) {
      const all = await this.areas.find();
      return {
        error: `No existe el área "${args.area}".`,
        areasDisponibles: all.map((a) => a.nombre),
      };
    }

    const where = args.competenciaIds?.length
      ? { areaId: area.id, id: In(args.competenciaIds) }
      : { areaId: area.id };
    const comps = await this.competencias.find({ where });
    const compIds = comps.map((c) => c.id);

    const [caps, ests] = await Promise.all([
      compIds.length ? this.capacidades.find({ where: { competenciaId: In(compIds) } }) : [],
      compIds.length ? this.estandares.find({ where: { competenciaId: In(compIds) } }) : [],
    ]);

    return {
      area: { id: area.id, nombre: area.nombre },
      competencias: comps.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        capacidades: caps
          .filter((cap) => cap.competenciaId === c.id)
          .map((cap) => ({ codigo: cap.codigo, nombre: cap.nombre })),
        estandares: ests
          .filter((e) => e.competenciaId === c.id)
          .map((e) => ({ ciclo: e.ciclo, descripcion: e.descripcion })),
      })),
    };
  }

  /**
   * obtener_desempenos → los desempeños REALES (con `codigo`) de esas
   * competencias y grados. Es la verdad citable: solo devuelve filas citables
   * (codigo no nulo, needsReview=false).
   */
  async obtenerDesempenos(args: ObtenerDesempenosArgs): Promise<unknown> {
    if (!args.competenciaIds?.length || !args.grados?.length) {
      return { desempenos: [], nota: 'Indica competenciaIds y grados.' };
    }
    const [rows, comps] = await Promise.all([
      this.desempenos.find({
        where: {
          competenciaId: In(args.competenciaIds),
          grado: In(args.grados),
          needsReview: false,
        },
        order: { grado: 'ASC', codigo: 'ASC' },
      }),
      this.competencias.find({ where: { id: In(args.competenciaIds) } }),
    ]);
    const codigoByComp = new Map(comps.map((c) => [c.id, c.codigo]));

    // Blindaje extra: nunca exponer un desempeño sin código (no citable).
    const citables = rows.filter((d) => d.codigo !== null);
    return {
      desempenos: citables.map((d) => ({
        codigo: d.codigo,
        descripcion: d.descripcion,
        grado: d.grado,
        competenciaId: d.competenciaId,
        competenciaCodigo: codigoByComp.get(d.competenciaId) ?? null,
      })),
      nota: 'Cita ÚNICAMENTE estos códigos. No inventes ningún código de desempeño.',
    };
  }

  /**
   * buscar_recursos_contexto → pistas de contextualización (contexto amazónico,
   * notas de lengua originaria). MVP: strings curados, sin llamadas externas.
   */
  buscarRecursosContexto(args: BuscarRecursosContextoArgs): unknown {
    const lengua = (args.lengua ?? '').trim().toLowerCase();
    const notaLengua =
      NOTAS_LENGUA[lengua] ??
      'Adapta la sesión a la lengua indicada respetando el enfoque intercultural bilingüe (EIB).';
    return {
      contexto: args.contexto ?? null,
      sugerenciasContextualizacion: CONTEXTO_AMAZONICO,
      notaLengua,
      enfoquesSugeridos: ['Enfoque intercultural', 'Enfoque ambiental', 'Enfoque de derechos'],
    };
  }

  /**
   * guardar_sesion → persiste GenerationAudit + SesionAprendizaje (estado=borrador).
   * Lo invoca el orquestador SOLO después de que el Verificador aprueba el
   * contenido, de modo que nunca se guarda una sesión con citas inventadas.
   */
  async guardarSesion(input: GuardarSesionInput): Promise<SesionAprendizaje> {
    const audit = await this.audits.save(
      this.audits.create({
        prompt: input.audit.prompt,
        contextoUsado: input.audit.contextoUsado,
        versionCurriculo: input.audit.versionCurriculo ?? null,
        modelo: input.audit.modelo ?? null,
        tokens: input.audit.tokens ?? 0,
      }),
    );

    const sesion = await this.sesiones.save(
      this.sesiones.create({
        docenteId: input.docenteId,
        escuelaId: input.escuelaId ?? null,
        grados: input.grados,
        areaId: input.areaId,
        competenciaIds: input.competenciaIds,
        lengua: input.lengua,
        contexto: input.contexto ?? null,
        contenidoJson: input.contenidoJson,
        estado: EstadoSesion.BORRADOR,
        generationAuditId: audit.id,
      }),
    );
    this.logger.log(`Sesión ${sesion.id} guardada (borrador) con auditoría ${audit.id}.`);
    return sesion;
  }

  /**
   * guardarEvaluacion → persiste GenerationAudit + Evaluacion (estado=borrador).
   * Igual que `guardarSesion`, lo invoca el gate SOLO tras aprobar el Verificador,
   * de modo que nunca se guarda un examen con desempeños inventados.
   */
  async guardarEvaluacion(input: GuardarEvaluacionInput): Promise<Evaluacion> {
    const audit = await this.audits.save(
      this.audits.create({
        prompt: input.audit.prompt,
        contextoUsado: input.audit.contextoUsado,
        versionCurriculo: input.audit.versionCurriculo ?? null,
        modelo: input.audit.modelo ?? null,
        tokens: input.audit.tokens ?? 0,
      }),
    );

    const evaluacion = await this.evaluaciones.save(
      this.evaluaciones.create({
        docenteId: input.docenteId,
        grado: input.grado,
        areaId: input.areaId,
        competenciaIds: input.competenciaIds,
        contenidoJson: input.contenidoJson,
        estado: EstadoEvaluacion.BORRADOR,
        generationAuditId: audit.id,
      }),
    );
    this.logger.log(`Evaluación ${evaluacion.id} guardada (borrador) con auditoría ${audit.id}.`);
    return evaluacion;
  }
}
