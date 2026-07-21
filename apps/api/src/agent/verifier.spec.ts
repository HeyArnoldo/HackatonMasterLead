import {
  ContenidoEvaluacion,
  ContenidoSesion,
  MomentoNombre,
  TipoItemEvaluacion,
} from '@app/contracts';
import { Desempeno } from '../curriculum/desempeno.entity';
import {
  checkCitas,
  checkCitasEvaluacion,
  checkEstructura,
  checkMultigrado,
  VerifierService,
} from './verifier.service';

/** Sesión base válida (un grado, cita un desempeño real). */
function baseContenido(overrides: Partial<ContenidoSesion> = {}): ContenidoSesion {
  return {
    titulo: 'Contamos objetos de la chacra',
    datosInformativos: { area: 'Matemática', grados: [1], lengua: 'castellano' },
    propositoGeneral: 'Los estudiantes resuelven problemas de cantidad usando material concreto.',
    propositosAprendizaje: [
      {
        competenciaCodigo: 'MAT-C1',
        competenciaNombre: 'Resuelve problemas de cantidad',
        capacidades: ['Traduce cantidades a expresiones numéricas'],
        desempenos: [{ codigo: 'MAT-C1-G1-01', descripcion: 'Establece relaciones...', grado: 1 }],
        evidencia: 'Ficha con conteo de semillas resuelta.',
      },
    ],
    enfoquesTransversales: ['Enfoque ambiental'],
    momentos: [
      {
        nombre: MomentoNombre.INICIO,
        actividades: ['Saludo y saberes previos'],
        actividadesPorGrado: [],
        recursos: [],
      },
      {
        nombre: MomentoNombre.DESARROLLO,
        actividades: ['Resolvemos problemas'],
        actividadesPorGrado: [],
        recursos: [],
      },
      {
        nombre: MomentoNombre.CIERRE,
        actividades: ['Metacognición'],
        actividadesPorGrado: [],
        recursos: [],
      },
    ],
    materiales: ['Semillas', 'Piedritas'],
    ...overrides,
  };
}

describe('checkCitas (integridad de citas)', () => {
  it('rechaza un código citado que NO está en la BD', () => {
    const contenido = baseContenido({
      propositosAprendizaje: [
        {
          competenciaCodigo: 'MAT-C1',
          competenciaNombre: 'Resuelve problemas de cantidad',
          capacidades: [],
          desempenos: [{ codigo: 'MAT-C1-G1-99', descripcion: 'inventado', grado: 1 }],
          evidencia: 'x',
        },
      ],
    });
    const valid = new Set(['MAT-C1-G1-01', 'MAT-C1-G1-02']);
    const { errors, invalidCodigos } = checkCitas(contenido, valid);
    expect(invalidCodigos).toEqual(['MAT-C1-G1-99']);
    expect(errors).toHaveLength(1);
  });

  it('acepta cuando todos los códigos citados existen en la BD', () => {
    const valid = new Set(['MAT-C1-G1-01']);
    const { errors, invalidCodigos } = checkCitas(baseContenido(), valid);
    expect(invalidCodigos).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe('checkMultigrado (diferenciación por grado)', () => {
  it('un solo grado no exige diferenciación', () => {
    expect(checkMultigrado(baseContenido(), [1])).toEqual([]);
  });

  it('multigrado sin actividades diferenciadas para un grado → error', () => {
    const contenido = baseContenido({
      momentos: [
        {
          nombre: MomentoNombre.INICIO,
          actividades: ['común'],
          actividadesPorGrado: [],
          recursos: [],
        },
        {
          nombre: MomentoNombre.DESARROLLO,
          actividades: [],
          actividadesPorGrado: [{ grado: 1, actividades: ['solo grado 1'] }],
          recursos: [],
        },
        {
          nombre: MomentoNombre.CIERRE,
          actividades: ['común'],
          actividadesPorGrado: [],
          recursos: [],
        },
      ],
    });
    const errors = checkMultigrado(contenido, [1, 2]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('grado 2');
  });

  it('multigrado con actividades diferenciadas para cada grado → OK', () => {
    const contenido = baseContenido({
      momentos: [
        {
          nombre: MomentoNombre.INICIO,
          actividades: ['común'],
          actividadesPorGrado: [],
          recursos: [],
        },
        {
          nombre: MomentoNombre.DESARROLLO,
          actividades: [],
          actividadesPorGrado: [
            { grado: 1, actividades: ['para grado 1'] },
            { grado: 2, actividades: ['para grado 2'] },
          ],
          recursos: [],
        },
        {
          nombre: MomentoNombre.CIERRE,
          actividades: ['común'],
          actividadesPorGrado: [],
          recursos: [],
        },
      ],
    });
    expect(checkMultigrado(contenido, [1, 2])).toEqual([]);
  });
});

describe('checkEstructura', () => {
  it('exige los tres momentos (inicio/desarrollo/cierre)', () => {
    const contenido = baseContenido({
      momentos: [
        { nombre: MomentoNombre.INICIO, actividades: ['a'], actividadesPorGrado: [], recursos: [] },
        {
          nombre: MomentoNombre.DESARROLLO,
          actividades: ['b'],
          actividadesPorGrado: [],
          recursos: [],
        },
      ],
    });
    const errors = checkEstructura(contenido);
    expect(errors.some((e) => e.includes('cierre'))).toBe(true);
  });

  it('una sesión bien formada no produce errores estructurales', () => {
    expect(checkEstructura(baseContenido())).toEqual([]);
  });
});

describe('VerifierService.verify (con repo mockeado)', () => {
  function makeService(codigosEnBd: string[]): VerifierService {
    const repo = {
      find: jest.fn().mockResolvedValue(codigosEnBd.map((codigo) => ({ codigo }) as Desempeno)),
    };
    return new VerifierService(repo as never);
  }

  it('acepta una sesión que solo cita desempeños reales', async () => {
    const service = makeService(['MAT-C1-G1-01']);
    const result = await service.verify(baseContenido(), {
      competenciaIds: ['comp-uuid'],
      grados: [1],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rechaza una sesión que cita un desempeño inexistente', async () => {
    const service = makeService(['MAT-C1-G1-01']); // la BD NO tiene el código inventado
    const contenido = baseContenido({
      propositosAprendizaje: [
        {
          competenciaCodigo: 'MAT-C1',
          competenciaNombre: 'Resuelve problemas de cantidad',
          capacidades: [],
          desempenos: [{ codigo: 'INVENTADO-01', descripcion: 'x', grado: 1 }],
          evidencia: 'y',
        },
      ],
    });
    const result = await service.verify(contenido, { competenciaIds: ['comp-uuid'], grados: [1] });
    expect(result.valid).toBe(false);
    expect(result.invalidCodigos).toContain('INVENTADO-01');
  });
});

/** Evaluación base válida (un ítem que cita un desempeño real). */
function baseEvaluacion(overrides: Partial<ContenidoEvaluacion> = {}): ContenidoEvaluacion {
  return {
    titulo: 'Evaluación de cantidad',
    area: 'Matemática',
    grado: 1,
    instrucciones: 'Resuelve cada problema.',
    items: [
      {
        enunciado: '¿Cuántas semillas hay?',
        tipo: TipoItemEvaluacion.RESPUESTA_ABIERTA,
        opciones: [],
        desempenoCodigo: 'MAT-C1-G1-01',
        puntaje: 2,
      },
    ],
    puntajeTotal: 2,
    ...overrides,
  };
}

describe('checkCitasEvaluacion (integridad de citas del examen)', () => {
  it('rechaza un ítem que evalúa un desempeño inexistente', () => {
    const contenido = baseEvaluacion({
      items: [
        {
          enunciado: 'x',
          tipo: TipoItemEvaluacion.RESPUESTA_ABIERTA,
          opciones: [],
          desempenoCodigo: 'MAT-C1-G1-99',
          puntaje: 1,
        },
      ],
      puntajeTotal: 1,
    });
    const { errors, invalidCodigos } = checkCitasEvaluacion(contenido, new Set(['MAT-C1-G1-01']));
    expect(invalidCodigos).toEqual(['MAT-C1-G1-99']);
    expect(errors).toHaveLength(1);
  });

  it('acepta cuando todos los ítems citan desempeños reales', () => {
    const { errors, invalidCodigos } = checkCitasEvaluacion(
      baseEvaluacion(),
      new Set(['MAT-C1-G1-01']),
    );
    expect(invalidCodigos).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe('VerifierService.verifyEvaluacion (con repo mockeado)', () => {
  function makeService(codigosEnBd: string[]): VerifierService {
    const repo = {
      find: jest.fn().mockResolvedValue(codigosEnBd.map((codigo) => ({ codigo }) as Desempeno)),
    };
    return new VerifierService(repo as never);
  }

  it('rechaza un examen que inventa un desempeño (gate del Verificador)', async () => {
    const service = makeService(['MAT-C1-G1-01']);
    const contenido = baseEvaluacion({
      items: [
        {
          enunciado: 'x',
          tipo: TipoItemEvaluacion.OPCION_MULTIPLE,
          opciones: ['a', 'b'],
          desempenoCodigo: 'INVENTADO-99',
          puntaje: 1,
        },
      ],
      puntajeTotal: 1,
    });
    const result = await service.verifyEvaluacion(contenido, {
      competenciaIds: ['comp-uuid'],
      grados: [1],
    });
    expect(result.valid).toBe(false);
    expect(result.invalidCodigos).toContain('INVENTADO-99');
  });

  it('acepta un examen cuyos ítems citan desempeños reales', async () => {
    const service = makeService(['MAT-C1-G1-01']);
    const result = await service.verifyEvaluacion(baseEvaluacion(), {
      competenciaIds: ['comp-uuid'],
      grados: [1],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
