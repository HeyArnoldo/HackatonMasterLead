import { ContenidoSesion } from '@app/contracts';
import { ToolAuditCollector } from '../agent/agent-tool-executor.service';
import {
  buildCopilotoTools,
  CopilotoToolsContext,
  proponerSesion,
  ProponerSesionArgs,
} from './copiloto-tools';

/**
 * Contenido de sesión de relleno para los tests del gate. La validez REAL la
 * decide el `VerifierService` (aquí mockeado): estas pruebas verifican el
 * wiring del gate, no las reglas del verificador (esas viven en verifier.spec).
 */
const contenidoDummy = {
  titulo: 'Sesión de prueba',
  datosInformativos: { area: 'Comunicación', grados: [1], lengua: 'castellano' },
  propositoGeneral: 'Propósito',
  propositosAprendizaje: [
    {
      competenciaCodigo: 'C1',
      competenciaNombre: 'Se comunica oralmente',
      capacidades: [],
      desempenos: [{ codigo: 'DES-1', descripcion: 'desc', grado: 1 }],
      evidencia: 'evidencia',
    },
  ],
  enfoquesTransversales: [],
  momentos: [
    { nombre: 'inicio', actividades: ['a'], actividadesPorGrado: [], recursos: [] },
    { nombre: 'desarrollo', actividades: ['b'], actividadesPorGrado: [], recursos: [] },
    { nombre: 'cierre', actividades: ['c'], actividadesPorGrado: [], recursos: [] },
  ],
  materiales: [],
} as ContenidoSesion;

function makeCtx(
  verify: jest.Mock,
  guardarSesion: jest.Mock,
): { ctx: CopilotoToolsContext; guardarSesion: jest.Mock } {
  const exec = {
    resolveArea: jest.fn().mockResolvedValue({ id: 'area-1', nombre: 'Comunicación' }),
    competenciaIdsDeArea: jest.fn().mockResolvedValue(['comp-1']),
    guardarSesion,
  };
  const verifier = { verify };
  const ctx: CopilotoToolsContext = {
    exec: exec as never,
    verifier: verifier as never,
    audit: new ToolAuditCollector(),
    docenteId: 'doc-1',
    modelo: 'gpt-4o',
  };
  return { ctx, guardarSesion };
}

const baseArgs: ProponerSesionArgs = {
  area: 'Comunicación',
  grados: [1],
  competenciaIds: ['comp-1'],
  lengua: 'castellano',
  contenidoJson: contenidoDummy,
};

describe('proponerSesion (gate del Verificador)', () => {
  it('RECHAZA una sesión con cita inválida ANTES de guardar (nunca persiste)', async () => {
    const verify = jest.fn().mockResolvedValue({
      valid: false,
      errors: ['Cita inválida: el desempeño "X-999" no existe en el currículo.'],
      invalidCodigos: ['X-999'],
    });
    const guardarSesion = jest.fn();
    const { ctx } = makeCtx(verify, guardarSesion);

    const result = await proponerSesion(ctx, baseArgs);

    expect(result.ok).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.invalidCodigos).toContain('X-999');
    expect(result.instruccion).toMatch(/verificador/i);
    // El gate JAMÁS guarda cuando la verificación falla.
    expect(guardarSesion).not.toHaveBeenCalled();
    expect(result.sesionId).toBeUndefined();
  });

  it('guarda como borrador SOLO cuando el Verificador aprueba', async () => {
    const verify = jest.fn().mockResolvedValue({ valid: true, errors: [], invalidCodigos: [] });
    const guardarSesion = jest.fn().mockResolvedValue({ id: 'sesion-1' });
    const { ctx } = makeCtx(verify, guardarSesion);

    const result = await proponerSesion(ctx, baseArgs);

    expect(result.ok).toBe(true);
    expect(result.sesionId).toBe('sesion-1');
    expect(guardarSesion).toHaveBeenCalledTimes(1);
  });
});

describe('buildCopilotoTools (wiring del copiloto)', () => {
  it('expone las 3 tools de recolección + proponer_sesion, sin guardado directo', () => {
    const ctx: CopilotoToolsContext = {
      exec: {} as never,
      verifier: {} as never,
      audit: new ToolAuditCollector(),
      docenteId: 'doc-1',
      modelo: 'gpt-4o',
    };

    const tools = buildCopilotoTools(ctx);

    expect(Object.keys(tools).sort()).toEqual(
      [
        'buscar_curriculo',
        'buscar_recursos_contexto',
        'obtener_desempenos',
        'proponer_sesion',
      ].sort(),
    );
    // El modelo NUNCA recibe una tool de guardado directo.
    expect(tools).not.toHaveProperty('guardar_sesion');
  });
});
