import type { ReactNode } from 'react';
import { LayersIcon } from 'lucide-react';
import { EstadoSesion, type ContenidoSesion, type Momento } from '@app/contracts';
import { cn } from '@/lib/utils';

const MOMENTO_LABEL: Record<string, string> = {
  inicio: 'Inicio',
  desarrollo: 'Desarrollo',
  cierre: 'Cierre',
};

/**
 * Chip prominente para el código oficial del desempeño — el diferenciador
 * visual clave del producto. Pill verde sólida, mono, siempre visible.
 */
function CodigoBadge({ codigo, className }: { codigo: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-primary px-2 py-0.5 font-mono text-[11px] font-bold tracking-tight text-primary-foreground',
        className,
      )}
    >
      {codigo}
    </span>
  );
}

/** Etiqueta eyebrow del diseño: 11px, bold, uppercase, verde o muted. */
function Eyebrow({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'green' }) {
  return (
    <p
      className={cn(
        'text-[11px] font-bold uppercase tracking-[0.05em]',
        tone === 'green' ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {children}
    </p>
  );
}

/** Tarjeta blanca redondeada del diseño (border #e3e9e1, radio 14). */
function WhiteCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[14px] border border-border bg-card p-5', className)}>
      {children}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
      {children}
    </span>
  );
}

function MomentoBlock({ momento }: { momento: Momento }) {
  return (
    <div className="rounded-[10px] border border-border bg-background/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {MOMENTO_LABEL[momento.nombre] ?? momento.nombre}
        </span>
        {momento.tiempo && (
          <span className="text-xs font-medium text-muted-foreground">{momento.tiempo}</span>
        )}
      </div>

      {momento.actividades.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {momento.actividades.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}

      {momento.actividadesPorGrado.length > 0 && (
        <div className="mt-2 space-y-2">
          {momento.actividadesPorGrado.map((g, i) => (
            <div key={i} className="rounded-[10px] border border-border bg-card p-3">
              <div className="mb-1">
                <Chip>{g.grado}° grado</Chip>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {g.actividades.map((a, j) => (
                  <li key={j}>{a}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {momento.recursos.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">Recursos:</span> {momento.recursos.join(', ')}
        </p>
      )}
    </div>
  );
}

export type SesionArtifactProps = {
  contenido: ContenidoSesion;
  estado?: EstadoSesion;
  /** Contenido extra en el encabezado (acciones, avisos). */
  header?: ReactNode;
  /** Pie del bloque (acciones de guardar/editar). */
  footer?: ReactNode;
  className?: string;
};

/**
 * Vista de sesión de aprendizaje con el look del diseño: eyebrow (ÁREA · GRADO ·
 * MIN), título grande y tarjetas blancas redondeadas. Muestra el código oficial
 * de cada desempeño de forma prominente y agrupa actividades por grado en
 * multigrado. El id `printable-session` habilita "Exportar PDF" vía impresión.
 */
export function SesionArtifact({
  contenido,
  estado,
  header,
  footer,
  className,
}: SesionArtifactProps) {
  const { datosInformativos: d } = contenido;
  const esMultigrado = d.grados.length > 1;
  const grados = d.grados.map((g) => `${g}°`).join(' y ');
  const eyebrow = [d.area, grados, d.duracion].filter(Boolean).join(' · ');

  return (
    <div id="printable-session" className={cn('space-y-4', className)}>
      {/* Encabezado */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Eyebrow tone="green">{eyebrow}</Eyebrow>
          {estado && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                estado === EstadoSesion.FINAL
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground',
              )}
            >
              {estado === EstadoSesion.FINAL ? 'Final' : 'Borrador'}
            </span>
          )}
          {esMultigrado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
              <LayersIcon className="size-3" /> Multigrado
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight">{contenido.titulo}</h1>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span>
            Área: <strong className="text-foreground">{d.area}</strong>
          </span>
          <span>
            Grados: <strong className="text-foreground">{grados}</strong>
          </span>
          <span>
            Lengua: <strong className="text-foreground">{d.lengua}</strong>
          </span>
          {d.duracion && (
            <span>
              Duración: <strong className="text-foreground">{d.duracion}</strong>
            </span>
          )}
        </div>
        {header}
      </div>

      {/* Propósito general */}
      {contenido.propositoGeneral && (
        <WhiteCard>
          <Eyebrow>Propósito de la sesión</Eyebrow>
          <p className="mt-2 text-sm leading-relaxed">{contenido.propositoGeneral}</p>
        </WhiteCard>
      )}

      {/* Propósitos de aprendizaje (competencia + desempeños con código) */}
      <WhiteCard>
        <Eyebrow>Propósitos de aprendizaje</Eyebrow>
        <div className="mt-3 space-y-4">
          {contenido.propositosAprendizaje.map((p, i) => (
            <div key={i} className="border-l-2 border-primary/40 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <CodigoBadge codigo={p.competenciaCodigo} />
                <span className="text-sm font-semibold">{p.competenciaNombre}</span>
              </div>

              {p.capacidades.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.capacidades.map((c, j) => (
                    <Chip key={j}>{c}</Chip>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-2">
                <Eyebrow>Desempeños</Eyebrow>
                {p.desempenos.map((des, j) => (
                  <div key={j} className="flex gap-2.5 text-sm">
                    <div className="flex shrink-0 flex-col items-start gap-1">
                      <CodigoBadge codigo={des.codigo} />
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {des.grado}° grado
                      </span>
                    </div>
                    <p className="leading-snug">{des.descripcion}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">Evidencia:</span> {p.evidencia}
              </p>
            </div>
          ))}
        </div>
      </WhiteCard>

      {/* Enfoques transversales */}
      {contenido.enfoquesTransversales.length > 0 && (
        <WhiteCard>
          <Eyebrow>Enfoques transversales</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {contenido.enfoquesTransversales.map((e, i) => (
              <Chip key={i}>{e}</Chip>
            ))}
          </div>
        </WhiteCard>
      )}

      {/* Secuencia didáctica (momentos) */}
      <WhiteCard>
        <Eyebrow>Secuencia didáctica</Eyebrow>
        <div className="mt-3 space-y-2.5">
          {contenido.momentos.map((m, i) => (
            <MomentoBlock key={i} momento={m} />
          ))}
        </div>
      </WhiteCard>

      {/* Materiales y recursos */}
      {contenido.materiales.length > 0 && (
        <WhiteCard>
          <Eyebrow>Materiales y recursos</Eyebrow>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {contenido.materiales.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </WhiteCard>
      )}

      {footer && <div className="pt-1">{footer}</div>}
    </div>
  );
}
