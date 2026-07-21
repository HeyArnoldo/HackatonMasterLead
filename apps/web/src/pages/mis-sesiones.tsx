import { Link } from 'react-router-dom';
import { BookOpenIcon, FileTextIcon, PlusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSesiones } from '@/hooks/use-sesiones';

export default function MisSesionesPage() {
  const { data: sesiones, isLoading, isError } = useSesiones();

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mis sesiones</h1>
        <Button asChild size="sm">
          <Link to="/">
            <PlusIcon className="size-4" />
            Nueva sesión
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No se pudieron cargar tus sesiones. Intenta de nuevo.
        </p>
      )}

      {sesiones && sesiones.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-10 text-center">
          <BookOpenIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Aún no tienes sesiones</p>
            <p className="text-sm text-muted-foreground">
              Conversa con el copiloto para crear tu primera sesión de aprendizaje.
            </p>
          </div>
          <Button asChild>
            <Link to="/">Ir al copiloto</Link>
          </Button>
        </div>
      )}

      {sesiones && sesiones.length > 0 && (
        <ul className="space-y-3">
          {sesiones.map((s) => (
            <li key={s.id}>
              <Link
                to={`/sesiones/${s.id}`}
                className="flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <FileTextIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{s.titulo ?? 'Sesión sin título'}</p>
                    <Badge variant={s.estado === 'final' ? 'default' : 'secondary'}>
                      {s.estado === 'final' ? 'Final' : 'Borrador'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.area ?? 'Área por definir'}
                    {s.grados.length > 0 && ` · ${s.grados.map((g) => `${g}°`).join(', ')}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
