import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * Proveedor de IA — OpenAI directo (NO Azure).
 *
 * La API arranca sin credenciales; la generación responde 503 hasta que
 * `OPENAI_API_KEY` esté presente en el entorno (reproducibilidad para el jurado).
 * La clave se lee de `process.env` (el ConfigModule ya cargó el .env al arrancar);
 * nunca se hardcodea.
 */

/** ¿Hay credenciales de OpenAI configuradas? */
export function isAiEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Nombre del modelo (también para registrar en la auditoría). Configurable por env. */
export function agentModelName(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o';
}

function provider() {
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/** Modelo del agente (razonamiento + tools). */
export function agentModel(): LanguageModel {
  return provider()(agentModelName());
}
