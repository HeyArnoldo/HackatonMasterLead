import { Link } from 'react-router-dom';
import { ArrowRightIcon, FileTextIcon } from 'lucide-react';
import type { ContenidoSesion } from '@app/contracts';

function eyebrow(contenido: ContenidoSesion): string {
  const d = contenido.datosInformativos;
  const grados = d.grados.map((g) => `${g}°`).join(' y ');
  return [d.area, grados, d.duracion].filter(Boolean).join(' · ');
}

/**
 * Tarjeta compacta de sesión dentro del chat: título + "Área · grado · min" +
 * botón verde "Ver sesión" que abre la vista de sesión (contenido real con los
 * códigos oficiales de desempeño). Si aún no hay `sesionId`, degrada a un aviso.
 */
export function SessionCard({
  contenido,
  sesionId,
}: {
  contenido: ContenidoSesion;
  sesionId?: string;
}) {
  return (
    <div className="mt-2 w-full max-w-md rounded-[14px] border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-primary">
          <FileTextIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
            {eyebrow(contenido)}
          </p>
          <h4 className="mt-0.5 text-sm font-semibold leading-tight">{contenido.titulo}</h4>
        </div>
      </div>

      {sesionId ? (
        <Link
          to={`/sesiones/${sesionId}`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ver sesión
          <ArrowRightIcon className="size-3.5" />
        </Link>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Guardando la sesión como borrador…</p>
      )}
    </div>
  );
}
