import { BrainIcon, ChevronDownIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/** Bloque de razonamiento del modelo, colapsable y discreto. */
export function Reasoning({
  text,
  isStreaming = false,
  className,
}: {
  text: string;
  isStreaming?: boolean;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={isStreaming} className={cn('not-prose w-full', className)}>
      <CollapsibleTrigger className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <BrainIcon className="size-4" />
        {isStreaming ? 'Pensando…' : 'Razonamiento'}
        <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
        {text}
      </CollapsibleContent>
    </Collapsible>
  );
}
