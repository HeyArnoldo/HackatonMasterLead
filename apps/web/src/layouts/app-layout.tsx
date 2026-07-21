import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3Icon,
  LogOut,
  MessagesSquareIcon,
  PlusIcon,
  User as UserIcon,
} from 'lucide-react';
import { UserRole } from '@app/contracts';
import { useLogout, useMe } from '@/hooks/use-auth';
import { useConversaciones } from '@/hooks/use-conversaciones';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** Contexto del header según la ruta activa (rol docente o director). */
function useHeader(pathname: string) {
  if (pathname.startsWith('/director')) {
    return {
      icon: <BarChart3Icon className="size-5" />,
      title: 'Panel del Director',
      tag: 'MÉTRICAS',
    };
  }
  if (pathname.startsWith('/sesiones/')) {
    return {
      icon: <MessagesSquareIcon className="size-5" />,
      title: 'Sesión de aprendizaje',
      tag: 'PLAN DE CLASE',
    };
  }
  return {
    icon: <MessagesSquareIcon className="size-5" />,
    title: 'Hilo principal',
    tag: 'CHAT · PLAN DE CLASE',
  };
}

function RoleToggle({ isDirectorView }: { isDirectorView: boolean }) {
  const navigate = useNavigate();
  const tabBase =
    'flex-1 rounded-lg py-2 text-center text-[13px] font-semibold transition-colors cursor-pointer';
  return (
    <div className="mb-5 flex rounded-[10px] bg-secondary p-1">
      <button
        type="button"
        onClick={() => navigate('/')}
        className={cn(
          tabBase,
          !isDirectorView ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground',
        )}
      >
        Docente
      </button>
      <button
        type="button"
        onClick={() => navigate('/director')}
        className={cn(
          tabBase,
          isDirectorView ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground',
        )}
      >
        Director
      </button>
    </div>
  );
}

function DocenteNav() {
  const { data: conversaciones } = useConversaciones();
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary"
      >
        <PlusIcon className="size-[18px]" /> Nueva sesión
      </button>

      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          cn(
            'mb-5 flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm font-semibold',
            isActive ? 'bg-secondary text-primary' : 'text-foreground hover:bg-secondary/60',
          )
        }
      >
        <span className="size-2 rounded-full bg-primary" /> Hilo principal
      </NavLink>

      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
        Recientes
      </p>
      <nav className="min-h-0 flex-1 overflow-y-auto">
        {conversaciones?.length ? (
          conversaciones.map((c) => (
            <NavLink
              key={c.id}
              to={`/chat/${c.id}`}
              className={({ isActive }) =>
                cn(
                  'block truncate border-b border-border/70 px-1 py-2.5 text-sm',
                  isActive
                    ? 'font-medium text-primary'
                    : 'text-[#4b554c] dark:text-muted-foreground',
                )
              }
              title={c.titulo}
            >
              {c.titulo || 'Sesión sin título'}
            </NavLink>
          ))
        ) : (
          <p className="px-1 py-2 text-xs text-muted-foreground">Aún no tienes conversaciones.</p>
        )}
      </nav>
    </>
  );
}

function DirectorNav() {
  return (
    <>
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
        Panel
      </p>
      <div className="px-1 py-2.5 text-sm font-semibold text-primary">Métricas generales</div>
      <div className="px-1 py-2.5 text-sm text-[#4b554c] dark:text-muted-foreground">
        Sesiones por docente
      </div>
      <div className="px-1 py-2.5 text-sm text-[#4b554c] dark:text-muted-foreground">
        Uso del asistente
      </div>
    </>
  );
}

export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const canDirector = user?.role === UserRole.ADMIN || user?.role === UserRole.DIRECTOR;
  const isDirectorView = pathname.startsWith('/director');
  const header = useHeader(pathname);

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login') });
  };

  return (
    <div className="flex h-screen bg-background font-sans text-foreground">
      {/* Sidebar */}
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5">
        <Link to="/" className="mb-5 text-xl font-bold">
          Yachai
        </Link>

        {canDirector && <RoleToggle isDirectorView={isDirectorView} />}

        <div className="flex min-h-0 flex-1 flex-col">
          {isDirectorView ? <DirectorNav /> : <DocenteNav />}
        </div>

        {/* Usuario */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-3 w-full justify-start gap-2">
              <UserIcon className="size-4" />
              <span className="truncate">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>

      {/* Área principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-7">
          <div className="flex items-center gap-2.5">
            <span className="text-primary">{header.icon}</span>
            <span className="text-base font-bold">{header.title}</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
              {header.tag}
            </span>
          </div>
          <ThemeToggle />
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
