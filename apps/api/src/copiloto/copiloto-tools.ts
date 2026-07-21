import { tool, ToolSet } from 'ai';
import { z } from 'zod';
import { ContenidoSesion, contenidoSesionSchema } from '@app/contracts';
import { AgentToolExecutorService, ToolAuditCollector } from '../agent/agent-tool-executor.service';
import { buildGatherTools } from '../agent/agent-tools';
import { VerifierService, VerificationResult } from '../agent/verifier.service';

/** Versión del currículo cargado (CNEB). Se registra en la auditoría. */
const VERSION_CURRICULO = 'CNEB-2016';

export interface CopilotoToolsContext {
  exec: AgentToolExecutorService;
  verifier: VerifierService;
  audit: ToolAuditCollector;
  /** Datos inyectados por el BACKEND (jamás por el modelo). */
  docenteId: string;
  modelo: string;
}

export interface ProponerSesionArgs {
  area: string;
  grados: number[];
  competenciaIds: string[];
  lengua: string;
  contexto?: string;
  contenidoJson: ContenidoSesion;
}

export interface ProponerSesionResult {
  ok: boolean;
  valid: boolean;
  sesionId?: string;
  titulo?: string;
  errors: string[];
  invalidCodigos: string[];
  instruccion?: string;
}

/**
 * GATE del Verificador para el copiloto conversacional.
 *
 * Verifica el contenido propuesto ANTES de guardar. Si la integridad de citas
 * (o la estructura/multigrado) falla, devuelve la corrección al modelo para que
 * vuelva a proponer (loop conversacional) y NO guarda NADA — nunca se persiste
 * ni se le presenta al docente una sesión con desempeños inventados. Solo cuando
 * el Verificador aprueba se guarda como borrador (reusa `guardarSesion`).
 *
 * Función pura de wiring (sin modelo ni HTTP) → testeable de forma aislada.
 */
export async function proponerSesion(
  ctx: CopilotoToolsContext,
  args: ProponerSesionArgs,
): Promise<ProponerSesionResult> {
  const { exec, verifier, audit, docenteId, modelo } = ctx;

  const area = await exec.resolveArea(args.area);
  // Ámbito de verificación: competencias indicadas, o TODAS las del área.
  const scopeCompetenciaIds = args.competenciaIds.length
    ? args.competenciaIds
    : area
      ? await exec.competenciaIdsDeArea(area.id)
      : [];

  const verification: VerificationResult = await verifier.verify(args.contenidoJson, {
    competenciaIds: scopeCompetenciaIds,
    grados: args.grados,
  });

  if (!verification.valid) {
    audit.record('proponer_sesion', args, { valid: false, errors: verification.errors });
    return {
      ok: false,
      valid: false,
      errors: verification.errors,
      invalidCodigos: verification.invalidCodigos,
      instruccion:
        'La sesión fue RECHAZADA por el verificador. Corrige estos errores y vuelve a llamar ' +
        'proponer_sesion. Si citaste un desempeño inexistente, obtén códigos reales con ' +
        'obtener_desempenos; JAMÁS inventes un código. No presentes esta sesión al docente ' +
        'hasta que el verificador la apruebe.',
    };
  }

  const sesion = await exec.guardarSesion({
    docenteId,
    areaId: area?.id ?? null,
    grados: args.grados,
    competenciaIds: args.competenciaIds,
    lengua: args.lengua,
    contexto: args.contexto ?? null,
    contenidoJson: args.contenidoJson,
    audit: {
      prompt: 'copiloto-conversacional',
      contextoUsado: { toolCalls: audit.all() },
      versionCurriculo: VERSION_CURRICULO,
      modelo,
    },
  });
  audit.record('proponer_sesion', args, { valid: true, sesionId: sesion.id });

  return {
    ok: true,
    valid: true,
    sesionId: sesion.id,
    titulo: args.contenidoJson.titulo,
    errors: [],
    invalidCodigos: [],
  };
}

/**
 * Tools del copiloto: las 3 de recolección (reusa el executor del agente) +
 * `proponer_sesion`, que corre el Verificador ANTES de guardar. El modelo NUNCA
 * recibe una tool de guardado directo: solo puede PROPONER; el gate decide.
 */
export function buildCopilotoTools(ctx: CopilotoToolsContext): ToolSet {
  const gather = buildGatherTools({
    exec: ctx.exec,
    audit: ctx.audit,
    docenteId: ctx.docenteId,
    areaId: null,
  });

  return {
    ...gather,
    proponer_sesion: tool({
      description:
        'Propone la sesión de aprendizaje final. Corre el VERIFICADOR (integridad de citas + ' +
        'estructura + multigrado) ANTES de guardar. Si algo falla, devuelve los errores para que ' +
        'corrijas y vuelvas a proponer. Solo cuando aprueba se guarda como borrador y se devuelve ' +
        'el `sesionId`. Llama esta tool SOLO cuando tengas el contenido completo y con desempeños ' +
        'reales obtenidos de obtener_desempenos.',
      inputSchema: z.object({
        area: z.string().describe('Nombre del área, ej "Comunicación" o "Matemática".'),
        grados: z
          .array(z.number().int().min(1).max(6))
          .min(1)
          .describe('Grados de la sesión (multigrado incluye todos).'),
        competenciaIds: z
          .array(z.string())
          .min(1)
          .describe('UUIDs de las competencias trabajadas (de buscar_curriculo).'),
        lengua: z.string().describe('Lengua de la sesión (castellano o lengua amazónica).'),
        contexto: z.string().optional().describe('Contexto local del aula/comunidad.'),
        contenidoJson: contenidoSesionSchema.describe(
          'La sesión completa en la forma canónica del CNEB.',
        ),
      }),
      execute: (args) => proponerSesion(ctx, args),
    }),
  };
}
