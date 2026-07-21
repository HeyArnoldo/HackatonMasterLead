import type { ReactNode } from 'react';
import { BookOpenIcon, LayersIcon, TargetIcon } from 'lucide-react';
import { EstadoSesion, type ContenidoSesion, type Momento } from '@app/contracts';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const MOMENTO_LABEL: Record<string, string> = {
  inicio: 'Inicio',
  desarrollo: 'Desarrollo',
  cierre: 'Cierre',
};

/** Chip para el código oficial del desempeño — el diferenciador visual clave. */
function CodigoBadge({ codigo }: { codigo: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
      {codigo}
    </span>
  );
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      {icon}
      {children}
    </h4>
  );
}

function MomentoBlock({ momento }: { momento: Momento }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {MOMENTO_LABEL[momento.nombre] ?? momento.nombre}
        </span>
        {momento.tiempo && (
          <Badge variant="outline" className="font-normal">
            {momento.tiempo}
          </Badge>
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
            <div key={i} className="rounded-md border bg-background p-2">
              <div className="mb-1">
                <Badge variant="secondary">{g.grado}° grado</Badge>
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
  /** Pie de la tarjeta (acciones de guardar/finalizar). */
  footer?: ReactNode;
  className?: string;
};

/**
 * Tarjeta rica de una sesión de aprendizaje (forma `contenidoSesionSchema`).
 * Muestra el código oficial de cada desempeño de forma prominente y agrupa las
 * actividades por grado en el caso multigrado.
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

  return (
    <div
      className={cn('overflow-hidden rounded-xl border bg-card text-card-foreground', className)}
    >
      {/* Encabezado */}
      <div className="border-b bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge className="gap-1">
                <BookOpenIcon className="size-3" />
                Sesión de aprendizaje
              </Badge>
              {estado && (
                <Badge variant={estado === EstadoSesion.FINAL ? 'default' : 'secondary'}>
                  {estado === EstadoSesion.FINAL ? 'Final' : 'Borrador'}
                </Badge>
              )}
              {esMultigrado && (
                <Badge variant="outline" className="gap-1">
                  <LayersIcon className="size-3" />
                  Multigrado
                </Badge>
              )}
            </div>
            <h3 className="text-base font-semibold leading-tight">{contenido.titulo}</h3>
          </div>
        </div>
        {header}
      </div>

      <div className="space-y-4 p-4">
        {/* Datos informativos */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Área:</span> <strong>{d.area}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Grados:</span>{' '}
            <strong>{d.grados.map((g) => `${g}°`).join(', ')}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Lengua:</span> <strong>{d.lengua}</strong>
          </span>
          {d.duracion && (
            <span>
              <span className="text-muted-foreground">Duración:</span> <strong>{d.duracion}</strong>
            </span>
          )}
        </div>

        {contenido.propositoGeneral && (
          <p className="rounded-lg bg-muted/40 p-3 text-sm">{contenido.propositoGeneral}</p>
        )}

        <Separator />

        {/* Propósitos de aprendizaje */}
        <div className="space-y-3">
          <SectionTitle icon={<TargetIcon className="size-4 text-muted-foreground" />}>
            Propósitos de aprendizaje
          </SectionTitle>
          {contenido.propositosAprendizaje.map((p, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <CodigoBadge codigo={p.competenciaCodigo} />
                <span className="text-sm font-medium">{p.competenciaNombre}</span>
              </div>

              {p.capacidades.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.capacidades.map((c, j) => (
                    <Badge key={j} variant="outline" className="font-normal">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Desempeños
                </p>
                {p.desempenos.map((des, j) => (
                  <div key={j} className="flex gap-2 text-sm">
                    <div className="flex shrink-0 flex-col items-start gap-1">
                      <CodigoBadge codigo={des.codigo} />
                      <Badge variant="secondary" className="text-[10px]">
                        {des.grado}° grado
                      </Badge>
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

        {contenido.enfoquesTransversales.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Enfoques transversales
            </p>
            <div className="flex flex-wrap gap-1.5">
              {contenido.enfoquesTransversales.map((e, i) => (
                <Badge key={i} variant="outline" className="font-normal">
                  {e}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Momentos */}
        <div className="space-y-2">
          <SectionTitle icon={<LayersIcon className="size-4 text-muted-foreground" />}>
            Secuencia didáctica
          </SectionTitle>
          <div className="space-y-2">
            {contenido.momentos.map((m, i) => (
              <MomentoBlock key={i} momento={m} />
            ))}
          </div>
        </div>

        {contenido.materiales.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Materiales
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {contenido.materiales.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {footer && <div className="border-t bg-muted/20 p-4">{footer}</div>}
    </div>
  );
}
