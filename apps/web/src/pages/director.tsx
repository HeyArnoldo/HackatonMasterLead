import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { InfoIcon } from 'lucide-react';
import { UserRole, type SesionResumen } from '@app/contracts';
import { useMe } from '@/hooks/use-auth';
import { useSesiones } from '@/hooks/use-sesiones';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Nota de datos de demostración: honestidad sobre lo real vs. lo simulado. */
function DemoNote({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground',
        className,
      )}
    >
      <InfoIcon className="size-3" /> datos de demostración
    </span>
  );
}

function StatCard({
  label,
  value,
  delta,
  demo,
}: {
  label: string;
  value: string | number;
  delta?: string;
  demo?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </p>
        {demo && <DemoNote />}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {delta && <p className="mt-1 text-xs font-semibold text-primary">{delta}</p>}
    </div>
  );
}

/** Métricas reales derivadas de GET /api/sesiones (single-tenant demo). */
function useMetricas(sesiones: SesionResumen[] | undefined) {
  return useMemo(() => {
    const total = sesiones?.length ?? 0;
    const finales = sesiones?.filter((s) => s.estado === 'final').length ?? 0;
    const semana = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recientes =
      sesiones?.filter((s) => new Date(s.createdAt).getTime() >= semana).length ?? 0;
    return { total, finales, recientes };
  }, [sesiones]);
}

/** Docentes de ejemplo (no hay backend multi-docente en el demo single-tenant). */
const DOCENTES_DEMO = [
  { docente: 'María Quispe', curso: 'Comunicación', sesiones: 12, ultima: 'Hoy' },
  { docente: 'José Mamani', curso: 'Matemática', sesiones: 9, ultima: 'Ayer' },
  { docente: 'Rosa Huamán', curso: 'Personal Social', sesiones: 7, ultima: 'Hace 3 días' },
  { docente: 'Luis Ccahua', curso: 'Ciencia y Tecnología', sesiones: 5, ultima: 'Hace 5 días' },
];

const USO_DEMO = [
  { dia: 'Lun', valor: 4 },
  { dia: 'Mar', valor: 7 },
  { dia: 'Mié', valor: 5 },
  { dia: 'Jue', valor: 9 },
  { dia: 'Vie', valor: 8 },
  { dia: 'Sáb', valor: 3 },
  { dia: 'Dom', valor: 2 },
];

export default function DirectorPage() {
  const { data: user } = useMe();
  const { data: sesiones, isLoading } = useSesiones();
  const m = useMetricas(sesiones);

  const canDirector = user?.role === UserRole.ADMIN || user?.role === UserRole.DIRECTOR;
  if (user && !canDirector) return <Navigate to="/" replace />;

  const maxUso = Math.max(...USO_DEMO.map((u) => u.valor));

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-6 py-6">
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Panel del Director</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Resumen del uso del asistente y de las sesiones creadas en la escuela.
      </p>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[14px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Sesiones creadas" value={m.total} delta="Total en la escuela" />
          <StatCard label="Sesiones finalizadas" value={m.finales} delta="Marcadas como final" />
          <StatCard label="Últimos 7 días" value={m.recientes} delta="Sesiones nuevas" />
        </div>
      )}

      {/* Tabla de docentes (demo) */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-bold">Sesiones creadas por docente</h2>
          <DemoNote />
        </div>
        <div className="overflow-hidden rounded-[14px] border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                <th className="px-5 py-3">Docente</th>
                <th className="px-5 py-3">Curso</th>
                <th className="px-5 py-3">Sesiones</th>
                <th className="px-5 py-3">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {DOCENTES_DEMO.map((d) => (
                <tr key={d.docente} className="border-b border-border/70 last:border-0">
                  <td className="px-5 py-3 font-medium">{d.docente}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.curso}</td>
                  <td className="px-5 py-3 font-semibold text-primary">{d.sesiones}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.ultima}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gráfico de uso 7 días (demo, barras verdes CSS) */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-bold">Conversaciones por día (últimos 7 días)</h2>
          <DemoNote />
        </div>
        <div className="rounded-[14px] border border-border bg-card p-6">
          <div className="flex h-48 items-end justify-between gap-3">
            {USO_DEMO.map((u) => (
              <div key={u.dia} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{u.valor}</span>
                <div
                  className="w-full rounded-t-md bg-primary transition-all"
                  style={{ height: `${(u.valor / maxUso) * 100}%` }}
                  role="img"
                  aria-label={`${u.dia}: ${u.valor} conversaciones`}
                />
                <span className="text-xs font-medium text-muted-foreground">{u.dia}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
