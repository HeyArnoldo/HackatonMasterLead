import { tool, ToolSet } from 'ai';
import { z } from 'zod';
import { AgentToolExecutorService, ToolAuditCollector } from './agent-tool-executor.service';

/**
 * Registro de tools del generador de sesiones (Yachai). Espeja la estructura de
 * mayordomo, pero las tools resuelven currículo/escuela reales.
 *
 * GUARDRAILS:
 * - Toda llamada queda registrada en el `audit` (rastro → GenerationAudit.contextoUsado).
 * - La IA solo responde/cita con lo que devuelven estas tools; cero invención.
 * - `guardar_sesion` se registra por paridad pero NO se entrega al loop del modelo:
 *   el orquestador guarda recién DESPUÉS de que el Verificador aprueba, para que
 *   jamás se persista una sesión con desempeños inventados.
 */
export interface AgentToolsContext {
  exec: AgentToolExecutorService;
  audit: ToolAuditCollector;
  /** Datos del docente/pedido, inyectados por el BACKEND (jamás por el modelo). */
  docenteId: string;
  areaId: string | null;
}

/** Ejecuta la tool y registra args+result en el rastro de auditoría. */
async function audited<T>(
  audit: ToolAuditCollector,
  toolName: string,
  args: unknown,
  run: () => Promise<T> | T,
): Promise<T> {
  const result = await run();
  audit.record(toolName, args, result);
  return result;
}

/**
 * Tools de recolección que se entregan al loop del modelo (las 3 de lectura).
 * `guardar_sesion` queda fuera a propósito (ver nota arriba).
 */
export function buildGatherTools(ctx: AgentToolsContext): ToolSet {
  const { exec, audit } = ctx;
  return {
    buscar_curriculo: tool({
      description:
        'Devuelve las competencias del área (con sus capacidades y estándares por ciclo). ' +
        'Úsala primero para conocer qué competencias existen y elegir cuáles trabajar.',
      inputSchema: z.object({
        area: z.string().describe('Nombre del área curricular, ej "Matemática" o "Comunicación".'),
        competenciaIds: z
          .array(z.string())
          .optional()
          .describe('Opcional: limita a estas competencias (UUIDs). Omitir para traer todas.'),
      }),
      execute: (args) => audited(audit, 'buscar_curriculo', args, () => exec.buscarCurriculo(args)),
    }),

    obtener_desempenos: tool({
      description:
        'Devuelve los desempeños REALES (con su `codigo` oficial) para esas competencias y grados. ' +
        'Es la ÚNICA fuente de códigos citables. NUNCA cites un código que no venga de aquí.',
      inputSchema: z.object({
        competenciaIds: z
          .array(z.string())
          .min(1)
          .describe('UUIDs de las competencias a trabajar (de buscar_curriculo).'),
        grados: z
          .array(z.number().int().min(1).max(6))
          .min(1)
          .describe('Grados a cubrir (1..6). Para multigrado incluye todos, ej [1, 2].'),
      }),
      execute: (args) =>
        audited(audit, 'obtener_desempenos', args, () => exec.obtenerDesempenos(args)),
    }),

    buscar_recursos_contexto: tool({
      description:
        'Pistas de contextualización (contexto amazónico, notas de lengua originaria, enfoques ' +
        'transversales sugeridos) para adaptar la sesión al aula EIB.',
      inputSchema: z.object({
        contexto: z
          .string()
          .optional()
          .describe('Descripción del contexto del aula/comunidad, si la hay.'),
        lengua: z.string().optional().describe('Lengua de la sesión, ej "castellano", "awajun".'),
      }),
      execute: (args) =>
        audited(audit, 'buscar_recursos_contexto', args, () => exec.buscarRecursosContexto(args)),
    }),
  };
}
