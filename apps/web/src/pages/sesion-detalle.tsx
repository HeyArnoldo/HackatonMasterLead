import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CheckCircleIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { EstadoSesion } from '@app/contracts';
import { SesionArtifact } from '@/components/sesion-artifact';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActualizarSesion, useSesion } from '@/hooks/use-sesiones';

export default function SesionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data: sesion, isLoading, isError } = useSesion(id);
  const actualizar = useActualizarSesion(id ?? '');

  const finalizar = () => {
    actualizar.mutate(
      { estado: EstadoSesion.FINAL },
      {
        onSuccess: () => toast.success('Sesión marcada como final.'),
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

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto p-4">
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/sesiones">
          <ArrowLeftIcon className="size-4" />
          Mis sesiones
        </Link>
      </Button>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No se pudo cargar la sesión.
        </p>
      )}

      {sesion && !sesion.contenidoJson && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Esta sesión todavía no tiene contenido generado.
        </div>
      )}

      {sesion && sesion.contenidoJson && (
        <SesionArtifact
          contenido={sesion.contenidoJson}
          estado={sesion.estado}
          footer={
            <div className="flex items-center justify-end gap-2">
              {sesion.estado === EstadoSesion.BORRADOR ? (
                <Button onClick={finalizar} disabled={actualizar.isPending}>
                  {actualizar.isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="size-4" />
                  )}
                  Marcar como final
                </Button>
              ) : (
                <Button variant="outline" onClick={reabrir} disabled={actualizar.isPending}>
                  {actualizar.isPending && <Loader2Icon className="size-4 animate-spin" />}
                  Volver a borrador
                </Button>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
