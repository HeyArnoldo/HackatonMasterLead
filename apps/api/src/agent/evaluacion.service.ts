import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { generateText, stepCountIs } from 'ai';
import {
  ContenidoEvaluacion,
  contenidoEvaluacionSchema,
  CrearEvaluacionInput,
} from '@app/contracts';
import { Evaluacion } from '../evaluaciones/evaluacion.entity';
import { agentModel, agentModelName, isAiEnabled } from './ai.config';
import { AgentToolExecutorService, ToolAuditCollector } from './agent-tool-executor.service';
import { buildGatherTools } from './agent-tools';
import { VerifierService, VerificationResult } from './verifier.service';

const MAX_STEPS = 8;
const MAX_RETRIES = 2;
const VERSION_CURRICULO = 'CNEB-2016';

export interface GenerarEvaluacionResult {
  evaluacion: Evaluacion;
  contenido: ContenidoEvaluacion;
  verification: VerificationResult;
}

/**
 * Generador de EVALUACIONES/exámenes (Yachai). Mismo patrón Planner-Executor +
 * Critic/Verifier que el generador de sesiones: la IA consulta el currículo real
 * con tools scopeadas y el Verificador valida las citas ANTES de guardar, de modo
 * que cada ítem quede anclado a un desempeño REAL del CNEB.
 */
@Injectable()
export class EvaluacionGeneratorService {
  private readonly logger = new Logger(EvaluacionGeneratorService.name);

  constructor(
    private readonly exec: AgentToolExecutorService,
    private readonly verifier: VerifierService,
  ) {}

  buildSystemPrompt(): string {
    return [
      'Eres un asistente pedagógico experto en el Currículo Nacional (CNEB) del Perú.',
      'Generas EVALUACIONES (exámenes) alineadas al currículo para aulas rurales EIB de la Amazonía.',
      '',
      'REGLAS INQUEBRANTABLES:',
      '- Cada ítem/pregunta DEBE evaluar un desempeño cuyo `codigo` haya devuelto la tool `obtener_desempenos`.',
      '  JAMÁS inventes un código de desempeño; citar un código inexistente INVALIDA la evaluación.',
      '- Usa `buscar_curriculo` para conocer competencias/capacidades del área.',
      '- Usa `obtener_desempenos` para obtener los desempeños REALES (con su código) del grado.',
      '- Mezcla tipos de ítem: opción múltiple, verdadero/falso y respuesta abierta.',
      '',
      'FLUJO: (1) buscar_curriculo → (2) obtener_desempenos → (3) redactar la evaluación.',
      '',
      // Guía de estilo compacta derivada de evaluaciones REALES de aula (few-shot estructural):
      'GUÍA DE ESTILO (basada en evaluaciones reales de aula):',
      '- Empieza con INSTRUCCIONES claras y breves para el estudiante.',
      '- Mezcla tipos: respuesta abierta ("Responde: ..."), verdadero/falso ("coloca V o F"),',
      '  y opción múltiple ("selecciona la alternativa correcta" con 3-4 opciones).',
      '- Preguntas graduadas y contextualizadas (comunidad amazónica, saberes locales) según el grado.',
      '- Cada ítem asigna un puntaje; la suma es `puntajeTotal`.',
      '',
      'SALIDA: responde ÚNICAMENTE con un objeto JSON válido (sin texto ni markdown), con EXACTAMENTE esta forma:',
      JSON.stringify(
        {
          titulo: 'string',
          area: 'string',
          grado: 1,
          instrucciones: 'string',
          items: [
            {
              enunciado: 'string',
              tipo: 'opcionMultiple | verdaderoFalso | respuestaAbierta',
              opciones: ['string (solo opcionMultiple/verdaderoFalso)'],
              respuestaEsperada: 'string (clave para el docente)',
              desempenoCodigo: 'string REAL de obtener_desempenos',
              puntaje: 1,
            },
          ],
          puntajeTotal: 20,
        },
        null,
        0,
      ),
    ].join('\n');
  }

  private buildUserPrompt(input: CrearEvaluacionInput): string {
    return [
      `Área: ${input.area}`,
      `Grado: ${input.grado}`,
      `Tema: ${input.tema}`,
      input.competenciaIds.length
        ? `Competencias sugeridas (UUIDs): ${input.competenciaIds.join(', ')}`
        : 'Competencias: elige las apropiadas del área con buscar_curriculo.',
      '',
      'Genera la evaluación completa (varios ítems, mezcla de tipos) siguiendo el flujo y las reglas.',
    ].join('\n');
  }

  private parseContenido(text: string): ContenidoEvaluacion | null {
    const fenced = text.replace(/```(?:json)?/gi, '').trim();
    const start = fenced.indexOf('{');
    const end = fenced.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(fenced.slice(start, end + 1));
    } catch {
      return null;
    }
    const parsed = contenidoEvaluacionSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  /**
   * Genera, verifica y guarda (borrador) una evaluación. Lanza:
   * - 503 si no hay credenciales de IA.
   * - 400 si el área no existe.
   * - 422 si tras los reintentos el contenido sigue inválido (cita inventada, etc.).
   */
  async generar(docenteId: string, input: CrearEvaluacionInput): Promise<GenerarEvaluacionResult> {
    if (!isAiEnabled()) {
      throw new ServiceUnavailableException(
        'La generación con IA requiere OPENAI_API_KEY en el entorno.',
      );
    }

    const area = await this.exec.resolveArea(input.area);
    if (!area) {
      throw new BadRequestException(`No existe el área "${input.area}".`);
    }

    const scopeCompetenciaIds = input.competenciaIds.length
      ? input.competenciaIds
      : await this.exec.competenciaIdsDeArea(area.id);

    const audit = new ToolAuditCollector();
    const tools = buildGatherTools({ exec: this.exec, audit, docenteId, areaId: area.id });
    const system = this.buildSystemPrompt();
    const basePrompt = this.buildUserPrompt(input);

    let totalTokens = 0;
    let lastVerification: VerificationResult | null = null;
    let feedback = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { text, totalUsage } = await generateText({
        model: agentModel(),
        system,
        prompt: feedback ? `${basePrompt}\n\n${feedback}` : basePrompt,
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
      });
      totalTokens += (totalUsage?.inputTokens ?? 0) + (totalUsage?.outputTokens ?? 0);

      const contenido = this.parseContenido(text);
      if (!contenido) {
        feedback =
          'CORRECCIÓN: tu respuesta anterior no fue un JSON válido con la forma exigida. ' +
          'Responde ÚNICAMENTE con el objeto JSON, sin texto ni markdown.';
        this.logger.warn(`Intento ${attempt + 1}: JSON inválido, reintentando.`);
        continue;
      }

      const verification = await this.verifier.verifyEvaluacion(contenido, {
        competenciaIds: scopeCompetenciaIds,
        grados: [input.grado],
      });
      lastVerification = verification;

      if (verification.valid) {
        const evaluacion = await this.exec.guardarEvaluacion({
          docenteId,
          areaId: area.id,
          grado: input.grado,
          competenciaIds: input.competenciaIds,
          contenidoJson: contenido,
          audit: {
            prompt: `${system}\n\n${basePrompt}`,
            contextoUsado: { toolCalls: audit.all() },
            versionCurriculo: VERSION_CURRICULO,
            modelo: agentModelName(),
            tokens: totalTokens,
          },
        });
        this.logger.log(`Evaluación generada y verificada OK en intento ${attempt + 1}.`);
        return { evaluacion, contenido, verification };
      }

      feedback =
        'CORRECCIÓN: la evaluación anterior fue RECHAZADA por el verificador. Corrige estos errores ' +
        'y vuelve a generar el JSON completo. NO cites códigos que no vengan de obtener_desempenos:\n' +
        verification.errors.map((e) => `- ${e}`).join('\n');
      this.logger.warn(
        `Intento ${attempt + 1}: verificación falló (${verification.errors.length} errores).`,
      );
    }

    throw new UnprocessableEntityException({
      message: 'No se pudo generar una evaluación válida tras los reintentos.',
      errors: lastVerification?.errors ?? ['Contenido no parseable.'],
      invalidCodigos: lastVerification?.invalidCodigos ?? [],
    });
  }
}
