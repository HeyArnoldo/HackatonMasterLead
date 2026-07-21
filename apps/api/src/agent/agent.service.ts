import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { generateText, stepCountIs } from 'ai';
import { ContenidoSesion, contenidoSesionSchema, CrearSesionInput } from '@app/contracts';
import { SesionAprendizaje } from '../sesiones/sesion-aprendizaje.entity';
import { agentModel, agentModelName, isAiEnabled } from './ai.config';
import { AgentToolExecutorService, ToolAuditCollector } from './agent-tool-executor.service';
import { buildGatherTools } from './agent-tools';
import { VerifierService, VerificationResult } from './verifier.service';

/** Tope duro de iteraciones del bucle agéntico (guardrail de costo/loops). */
const MAX_STEPS = 8;
/** Reintentos ante contenido inválido (parseo o Verificador). */
const MAX_RETRIES = 2;
/** Versión del currículo cargado (CNEB). Se registra en la auditoría. */
const VERSION_CURRICULO = 'CNEB-2016';

export interface GenerarSesionResult {
  sesion: SesionAprendizaje;
  contenido: ContenidoSesion;
  verification: VerificationResult;
}

/**
 * Generador de sesiones de aprendizaje (Yachai). Patrón Planner-Executor +
 * Critic/Verifier: la IA razona en pasos y consulta el currículo real con
 * tools scopeadas; el Verificador valida el resultado ANTES de guardarlo,
 * garantizando que solo se citen desempeños reales del CNEB.
 *
 * Portado del "tool loop" de mayordomo (streamText + stepCountIs), adaptado a
 * una respuesta request/response con `generateText`: el endpoint devuelve la
 * sesión validada completa (no un stream de tokens).
 */
@Injectable()
export class SesionGeneratorService {
  private readonly logger = new Logger(SesionGeneratorService.name);

  constructor(
    private readonly exec: AgentToolExecutorService,
    private readonly verifier: VerifierService,
  ) {}

  /** System prompt pedagógico con la forma canónica de la sesión peruana. */
  buildSystemPrompt(): string {
    return [
      'Eres un asistente pedagógico experto en el Currículo Nacional de la Educación Básica (CNEB) del Perú,',
      'especializado en aulas EIB (Educación Intercultural Bilingüe) y en aulas MULTIGRADO de la Amazonía.',
      'Generas SESIONES DE APRENDIZAJE completas y contextualizadas.',
      '',
      'REGLAS INQUEBRANTABLES:',
      '- SOLO puedes citar desempeños cuyo `codigo` haya sido devuelto por la tool `obtener_desempenos`.',
      '  JAMÁS inventes un código de desempeño. Citar un código inexistente INVALIDA la sesión.',
      '- Usa `buscar_curriculo` para conocer las competencias/capacidades/estándares del área.',
      '- Usa `obtener_desempenos` para obtener los desempeños REALES (con su código) de las competencias y grados.',
      '- Usa `buscar_recursos_contexto` para contextualizar (contexto amazónico, lengua originaria, enfoques).',
      '- MULTIGRADO: si se piden varios grados, cada grado DEBE tener actividades diferenciadas',
      '  (usa `actividadesPorGrado` en los momentos). Es el diferenciador central del producto.',
      '',
      'FLUJO: (1) buscar_curriculo → (2) obtener_desempenos → (3) buscar_recursos_contexto → (4) redactar la sesión.',
      '',
      // Guía de estilo compacta derivada de sesiones REALES de aula peruana (few-shot estructural, no contenido):
      'GUÍA DE ESTILO (basada en sesiones reales de aula):',
      '- El propósito arranca con "Los estudiantes ..." y describe lo que logran + para qué.',
      '- INICIO: saludo/bienvenida, recojo de saberes previos y problematización con preguntas abiertas',
      '  (¿Qué observamos? ¿Qué sabemos? ¿Cómo se relaciona con nuestra comunidad?).',
      '- DESARROLLO (proceso): gestión y acompañamiento; actividades concretas con material del entorno,',
      '  trabajo guiado y luego autónomo; retroalimentación para la mejora del aprendizaje.',
      '- CIERRE: metacognición con preguntas (¿Qué hicimos? ¿Cómo me sentí? ¿Para qué me sirve?).',
      '- La evidencia es un PRODUCTO observable (ficha, cartel, maqueta, exposición) evaluable con lista de cotejo/rúbrica.',
      '- Redacta actividades claras, en pasos, con verbos de acción; contextualiza a la Amazonía (chacra, río, comunidad).',
      '',
      'SALIDA: responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown, sin ```).',
      'El JSON debe tener EXACTAMENTE esta forma:',
      JSON.stringify(
        {
          titulo: 'string',
          datosInformativos: {
            area: 'string',
            grados: [1, 2],
            lengua: 'string',
            duracion: 'string (opcional)',
          },
          propositoGeneral: 'string',
          propositosAprendizaje: [
            {
              competenciaCodigo: 'string (de buscar_curriculo)',
              competenciaNombre: 'string',
              capacidades: ['string'],
              desempenos: [
                { codigo: 'string REAL de obtener_desempenos', descripcion: 'string', grado: 1 },
              ],
              evidencia: 'string',
            },
          ],
          enfoquesTransversales: ['string'],
          momentos: [
            {
              nombre: 'inicio | desarrollo | cierre',
              tiempo: 'string (opcional)',
              actividades: ['string (comunes a todos los grados)'],
              actividadesPorGrado: [{ grado: 1, actividades: ['string'] }],
              recursos: ['string'],
            },
          ],
          materiales: ['string'],
        },
        null,
        0,
      ),
      '',
      'Incluye SIEMPRE los tres momentos: inicio, desarrollo y cierre.',
    ].join('\n');
  }

  private buildUserPrompt(input: CrearSesionInput): string {
    return [
      `Área: ${input.area}`,
      `Grados: ${input.grados.join(', ')}${input.grados.length > 1 ? ' (AULA MULTIGRADO)' : ''}`,
      `Tema: ${input.tema}`,
      `Lengua: ${input.lengua}`,
      input.contexto ? `Contexto: ${input.contexto}` : 'Contexto: (no especificado)',
      input.competenciaIds.length
        ? `Competencias sugeridas (UUIDs): ${input.competenciaIds.join(', ')}`
        : 'Competencias: elige las apropiadas del área con buscar_curriculo.',
      '',
      'Genera la sesión de aprendizaje completa siguiendo el flujo y las reglas.',
    ].join('\n');
  }

  /** Extrae y parsea el JSON del texto final del modelo (tolera fences ```). */
  private parseContenido(text: string): ContenidoSesion | null {
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
    const parsed = contenidoSesionSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  /**
   * Genera, verifica y guarda (borrador) una sesión. Lanza:
   * - 503 si no hay credenciales de IA.
   * - 400 si el área no existe.
   * - 422 si tras los reintentos el contenido sigue inválido (cita inventada, etc.).
   */
  async generar(docenteId: string, input: CrearSesionInput): Promise<GenerarSesionResult> {
    if (!isAiEnabled()) {
      throw new ServiceUnavailableException(
        'La generación con IA requiere OPENAI_API_KEY en el entorno.',
      );
    }

    const area = await this.exec.resolveArea(input.area);
    if (!area) {
      throw new BadRequestException(`No existe el área "${input.area}".`);
    }

    // Ámbito de verificación: competencias indicadas, o TODAS las del área.
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

      const verification = await this.verifier.verify(contenido, {
        competenciaIds: scopeCompetenciaIds,
        grados: input.grados,
      });
      lastVerification = verification;

      if (verification.valid) {
        const sesion = await this.exec.guardarSesion({
          docenteId,
          areaId: area.id,
          grados: input.grados,
          competenciaIds: input.competenciaIds,
          lengua: input.lengua,
          contexto: input.contexto ?? null,
          contenidoJson: contenido,
          audit: {
            prompt: `${system}\n\n${basePrompt}`,
            contextoUsado: { toolCalls: audit.all() },
            versionCurriculo: VERSION_CURRICULO,
            modelo: agentModelName(),
            tokens: totalTokens,
          },
        });
        this.logger.log(`Sesión generada y verificada OK en intento ${attempt + 1}.`);
        return { sesion, contenido, verification };
      }

      feedback =
        'CORRECCIÓN: la sesión anterior fue RECHAZADA por el verificador. Corrige estos errores ' +
        'y vuelve a generar el JSON completo. NO cites códigos que no vengan de obtener_desempenos:\n' +
        verification.errors.map((e) => `- ${e}`).join('\n');
      this.logger.warn(
        `Intento ${attempt + 1}: verificación falló (${verification.errors.length} errores).`,
      );
    }

    throw new UnprocessableEntityException({
      message: 'No se pudo generar una sesión válida tras los reintentos.',
      errors: lastVerification?.errors ?? ['Contenido no parseable.'],
      invalidCodigos: lastVerification?.invalidCodigos ?? [],
    });
  }
}
