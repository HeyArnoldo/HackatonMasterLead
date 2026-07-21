import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CheckCircleIcon, DownloadIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { EstadoSesion } from '@app/contracts';
import { SesionArtifact } from '@/components/sesion-artifact';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActualizarSesion, useSesion } from '@/hooks/use-sesiones';
import { sesionesApi } from '@/services/sesiones.api';

export default function SesionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data: sesion, isLoading, isError } = useSesion(id);
  const actualizar = useActualizarSesion(id ?? '');
  const [exporting, setExporting] = useState(false);

  const finalizar = () => {
    actualizar.mutate(
      { estado: EstadoSesion.FINAL },
      {
        onSuccess: () => toast.success('Sesión guardada como final.'),
        onError: () => toast.error('No se pudo actualizar la sesión.'),
      },
    );
  };

  const reabrir = () => {
    actualizar.mutate(
      { estado: EstadoSesion.BORRADOR },
      {
        onSuccess: () => toast.success('Sesión devuelta a borrador.'),
        onError: () => toast.error('No se pudo actualizar la sesión.'),
      },
    );
  };

  /** Exportar PDF: descarga el blob y lo abre en pestaña nueva; degrada con toast. */
  const exportarPdf = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const blob = await sesionesApi.pdf(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error('La exportación a PDF aún no está disponible. Inténtalo más tarde.');
    } finally {
      setExporting(false);
    }
  };

  const tieneContenido = Boolean(sesion?.contenidoJson);

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-6 py-5">
      {/* Barra superior: volver + exportar */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeftIcon className="size-4" />
            Volver al chat
          </Link>
        </Button>

        {tieneContenido && (
          <Button onClick={exportarPdf} disabled={exporting}>
            {exporting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
            Exportar PDF
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && (
        <p className="rounded-[14px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No se pudo cargar la sesión.
        </p>
      )}

      {sesion && !sesion.contenidoJson && (
        <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Esta sesión todavía no tiene contenido generado.
        </div>
      )}

      {sesion && sesion.contenidoJson && (
        <SesionArtifact
          contenido={sesion.contenidoJson}
          estado={sesion.estado}
          footer={
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              {sesion.estado === EstadoSesion.BORRADOR ? (
                <Button onClick={finalizar} disabled={actualizar.isPending}>
                  {actualizar.isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="size-4" />
                  )}
                  Guardar sesión
                </Button>
              ) : (
                <Button variant="outline" onClick={reabrir} disabled={actualizar.isPending}>
                  {actualizar.isPending && <Loader2Icon className="size-4 animate-spin" />}
                  Editar
                </Button>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
