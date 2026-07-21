import {
  ContenidoEvaluacion,
  ContenidoSesion,
  MomentoNombre,
  TipoItemEvaluacion,
} from '@app/contracts';
import { escapeLatex, escapeLatexList } from './latex.util';
import { renderSesionLatex } from './sesion-latex.template';
import { renderEvaluacionLatex } from './evaluacion-latex.template';

describe('escapeLatex', () => {
  it('escapa los caracteres especiales de LaTeX', () => {
    expect(escapeLatex('50% & #1 {a}_b $x ~y ^z')).toBe(
      '50\\% \\& \\#1 \\{a\\}\\_b \\$x \\textasciitilde{}y \\textasciicircum{}z',
    );
  });

  it('neutraliza intentos de inyección de comandos', () => {
    const out = escapeLatex('\\input{/etc/passwd}');
    expect(out).not.toContain('\\input{');
    expect(out).toContain('\\textbackslash{}');
  });

  it('tolera null/undefined devolviendo cadena vacía', () => {
    expect(escapeLatex(null)).toBe('');
    expect(escapeLatex(undefined)).toBe('');
    expect(escapeLatexList(['a&b', 'c%d'])).toEqual(['a\\&b', 'c\\%d']);
  });
});

/** Sesión mínima válida (multigrado) para las pruebas de plantilla. */
function baseSesion(overrides: Partial<ContenidoSesion> = {}): ContenidoSesion {
  return {
    titulo: 'Contamos semillas de la chacra',
    datosInformativos: {
      area: 'Matemática',
      grados: [1, 2],
      lengua: 'castellano',
      duracion: '90 min',
    },
    propositoGeneral: 'Resuelven problemas de cantidad con material concreto.',
    propositosAprendizaje: [
      {
        competenciaCodigo: 'MAT-C1',
        competenciaNombre: 'Resuelve problemas de cantidad',
        capacidades: ['Traduce cantidades'],
        desempenos: [{ codigo: 'MAT-C1-G1-01', descripcion: 'Establece relaciones', grado: 1 }],
        evidencia: 'Ficha resuelta.',
      },
    ],
    enfoquesTransversales: ['Enfoque ambiental'],
    momentos: [
      {
        nombre: MomentoNombre.INICIO,
        actividades: ['Saberes previos'],
        actividadesPorGrado: [],
        recursos: [],
      },
      {
        nombre: MomentoNombre.DESARROLLO,
        actividades: [],
        actividadesPorGrado: [
          { grado: 1, actividades: ['Cuenta hasta 10'] },
          { grado: 2, actividades: ['Cuenta hasta 20'] },
        ],
        recursos: ['Semillas'],
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

describe('renderSesionLatex', () => {
  it('produce un documento LaTeX completo con la estructura esperada', () => {
    const tex = renderSesionLatex(baseSesion());
    expect(tex).toContain('\\documentclass');
    expect(tex).toContain('\\begin{document}');
    expect(tex).toContain('\\end{document}');
    expect(tex).toContain('Contamos semillas de la chacra');
    // Cada desempeño se muestra con su código oficial.
    expect(tex).toContain('[MAT-C1-G1-01]');
    // Multigrado: actividades diferenciadas por grado.
    expect(tex).toContain('Grado 1');
    expect(tex).toContain('Grado 2');
    // Los tres momentos.
    expect(tex).toContain('Inicio');
    expect(tex).toContain('Desarrollo');
    expect(tex).toContain('Cierre');
  });

  it('escapa el texto del usuario/IA en el título', () => {
    const tex = renderSesionLatex(baseSesion({ titulo: 'Ahorro del 50% & más' }));
    expect(tex).toContain('Ahorro del 50\\% \\& más');
  });

  it('no emite itemize vacío cuando una lista está vacía', () => {
    const tex = renderSesionLatex(baseSesion({ enfoquesTransversales: [], materiales: [] }));
    expect(tex).not.toContain('\\begin{itemize}\n\n\\end{itemize}');
    expect(tex).not.toContain('\\begin{itemize}\\end{itemize}');
  });
});

function baseEvaluacion(overrides: Partial<ContenidoEvaluacion> = {}): ContenidoEvaluacion {
  return {
    titulo: 'Evaluación de comprensión lectora',
    area: 'Comunicación',
    grado: 3,
    instrucciones: 'Lee cada pregunta con atención.',
    items: [
      {
        enunciado: '¿Cuál es la idea principal del texto?',
        tipo: TipoItemEvaluacion.OPCION_MULTIPLE,
        opciones: ['La chacra', 'El río', 'La escuela'],
        respuestaEsperada: 'La chacra',
        desempenoCodigo: 'COM-C2-G3-04',
        puntaje: 4,
      },
      {
        enunciado: 'Explica con tus palabras qué aprendiste.',
        tipo: TipoItemEvaluacion.RESPUESTA_ABIERTA,
        opciones: [],
        desempenoCodigo: 'COM-C2-G3-05',
        puntaje: 6,
      },
    ],
    puntajeTotal: 10,
    ...overrides,
  };
}

describe('renderEvaluacionLatex', () => {
  it('produce un examen LaTeX con ítems anclados a su desempeño', () => {
    const tex = renderEvaluacionLatex(baseEvaluacion());
    expect(tex).toContain('\\begin{document}');
    expect(tex).toContain('\\end{document}');
    expect(tex).toContain('Evaluación de comprensión lectora');
    expect(tex).toContain('[COM-C2-G3-04]');
    expect(tex).toContain('[COM-C2-G3-05]');
    // Opciones de la pregunta de opción múltiple.
    expect(tex).toContain('La chacra');
    // Puntaje total.
    expect(tex).toContain('10 pts.');
  });

  it('escapa el enunciado del ítem', () => {
    const tex = renderEvaluacionLatex(
      baseEvaluacion({
        items: [
          {
            enunciado: '¿Cuánto es 50% de 100 & 200?',
            tipo: TipoItemEvaluacion.RESPUESTA_ABIERTA,
            opciones: [],
            desempenoCodigo: 'MAT-1',
            puntaje: 1,
          },
        ],
        puntajeTotal: 1,
      }),
    );
    expect(tex).toContain('50\\% de 100 \\& 200');
  });
});
