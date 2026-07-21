import type { ReactNode } from 'react';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  Loader2Icon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'
  | (string & {});

/** Etiquetas legibles en español para las tools del copiloto. */
const TOOL_LABELS: Record<string, string> = {
  buscar_curriculo: 'Buscando en el currículo',
  obtener_desempenos: 'Obteniendo desempeños oficiales',
  buscar_recursos_contexto: 'Buscando recursos de contexto',
  proponer_sesion: 'Proponiendo la sesión',
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
}

function statusIcon(state: ToolState): ReactNode {
  if (state === 'output-available')
    return <CheckCircleIcon className="size-3.5 text-emerald-600" />;
  if (state === 'output-error') return <XCircleIcon className="size-3.5 text-red-600" />;
  return <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />;
}

export type ToolProps = {
  name: string;
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  className?: string;
};

/** Tarjeta compacta y colapsable para una llamada de herramienta del copiloto. */
export function Tool({ name, state, input, output, errorText, className }: ToolProps) {
  const running = state !== 'output-available' && state !== 'output-error';
  return (
    <Collapsible className={cn('not-prose w-full rounded-lg border bg-muted/30', className)}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
        <span className="flex items-center gap-2 text-sm">
          <WrenchIcon className="size-3.5 text-muted-foreground" />
          <span className={cn('font-medium', running && 'text-muted-foreground')}>
            {toolLabel(name)}
            {running && '…'}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            {statusIcon(state)}
          </Badge>
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-3 pb-3 text-xs">
        {input !== undefined && (
          <div>
            <p className="mb-1 font-medium text-muted-foreground uppercase tracking-wide">
              Parámetros
            </p>
            <pre className="overflow-x-auto rounded bg-background p-2">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
        )}
        {errorText && (
          <div className="rounded bg-destructive/10 p-2 text-destructive">{errorText}</div>
        )}
        {output !== undefined && !errorText && (
          <div>
            <p className="mb-1 font-medium text-muted-foreground uppercase tracking-wide">
              Resultado
            </p>
            <pre className="max-h-48 overflow-auto rounded bg-background p-2">
              {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
            </pre>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
