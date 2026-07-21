import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ModelMessage, stepCountIs, streamText, StreamTextResult, ToolSet } from 'ai';
import { agentModel, agentModelName, isAiEnabled } from '../agent/ai.config';
import { AgentToolExecutorService, ToolAuditCollector } from '../agent/agent-tool-executor.service';
import { VerifierService } from '../agent/verifier.service';
import { buildCopilotoTools } from './copiloto-tools';

/** Tope duro de iteraciones del bucle agéntico (guardrail de costo/loops). */
const MAX_STEPS = 10;

/**
 * Copiloto conversacional de Yachai. Guía al docente rural amazónico (Loreto)
 * a construir una sesión de aprendizaje CONVERSANDO: recoge área, grado(s)
 * (multigrado), tema, lengua y contexto local, consulta el currículo real con
 * tools scopeadas y, cuando propone una sesión, la pasa por el Verificador
 * ANTES de guardarla o presentarla (nunca cita un desempeño inventado).
 *
 * Streaming con el AI SDK v6 (`streamText`) — protocolo UI Message Stream,
 * consumible con `@ai-sdk/react` `useChat`.
 */
@Injectable()
export class CopilotoService {
  constructor(
    private readonly exec: AgentToolExecutorService,
    private readonly verifier: VerifierService,
  ) {}

  /** ¿Está habilitado el copiloto (hay credenciales de IA)? */
  enabled(): boolean {
    return isAiEnabled();
  }

  /** System prompt: copiloto pedagógico cálido para aulas EIB/multigrado de Loreto. */
  buildSystemPrompt(): string {
    return [
      'Eres Yachai, un copiloto pedagógico CÁLIDO y cercano para docentes de escuelas rurales',
      'de la Amazonía peruana (Loreto), muchas veces aulas MULTIGRADO y de Educación Intercultural',
      'Bilingüe (EIB). Tu misión es acompañar al docente, CONVERSANDO, a construir una SESIÓN DE',
      'APRENDIZAJE completa del Currículo Nacional (CNEB). Hablas en español claro y respetuoso,',
      'con calidez humana; evitas tecnicismos innecesarios y valoras los saberes de la comunidad.',
      '',
      'INFORMACIÓN QUE DEBES REUNIR conversando (pregunta por lo que falte, NO asumas):',
      '- Área: Comunicación o Matemática.',
      '- Grado(s): uno o varios (si son varios, es aula MULTIGRADO).',
      '- Tema o situación significativa de la sesión.',
      '- Lengua: castellano o una lengua amazónica (ej. awajún, shipibo).',
      '- Contexto local: la comunidad, la chacra, el río, festividades, saberes propios.',
      'Haz UNA pregunta a la vez cuando falte algo; sé breve y amable. Si el docente ya dio un dato,',
      'no lo vuelvas a pedir.',
      '',
      'REGLAS INQUEBRANTABLES:',
      '- SOLO puedes citar desempeños cuyo `codigo` haya sido devuelto por la tool `obtener_desempenos`.',
      '  JAMÁS inventes un código de desempeño; citar un código inexistente INVALIDA la sesión.',
      '- MULTIGRADO: si hay varios grados, cada grado DEBE tener actividades diferenciadas',
      '  (usa `actividadesPorGrado` en los momentos). Es el corazón del producto.',
      '',
      'FLUJO DE TOOLS:',
      '1. `buscar_curriculo` → conoce las competencias/capacidades del área y elige cuáles trabajar.',
      '2. `obtener_desempenos` → obtén los desempeños REALES (con su código) de esas competencias y grados.',
      '3. `buscar_recursos_contexto` → pistas de contextualización amazónica y de lengua originaria.',
      '4. `proponer_sesion` → cuando tengas TODO, propón la sesión completa. Esta tool corre el',
      '   VERIFICADOR antes de guardar. Si te devuelve errores (por ejemplo una cita inválida),',
      '   CORRIGE y vuelve a llamar `proponer_sesion`. No le muestres al docente una sesión que el',
      '   verificador no haya aprobado. Cuando aprueba, te devuelve un `sesionId`: recién ahí',
      '   confírmale al docente que su sesión quedó guardada como borrador y resúmela con calidez.',
      '',
      'Nunca guardas la sesión por tu cuenta: solo la PROPONES; el verificador y el sistema deciden.',
    ].join('\n');
  }

  /**
   * Corre el copiloto en streaming. Devuelve el `StreamTextResult` (NO async)
   * para que el controller lo pipee al cliente y, en paralelo, espere
   * `.text`/`.toolCalls` para persistir el turno del asistente.
   */
  run(docenteId: string, messages: ModelMessage[]): StreamTextResult<ToolSet, never> {
    if (!isAiEnabled()) {
      throw new ServiceUnavailableException('El copiloto requiere OPENAI_API_KEY en el entorno.');
    }
    const audit = new ToolAuditCollector();
    const tools = buildCopilotoTools({
      exec: this.exec,
      verifier: this.verifier,
      audit,
      docenteId,
      modelo: agentModelName(),
    });

    return streamText({
      model: agentModel(),
      system: this.buildSystemPrompt(),
      messages,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });
  }
}
