import type { ComponentProps, HTMLAttributes } from 'react';
import { memo } from 'react';
import type { UIMessage } from 'ai';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage['role'];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group flex w-full flex-col gap-2',
      from === 'user' ? 'is-user items-end' : 'is-assistant items-start',
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> & {
  from?: UIMessage['role'];
};

export const MessageContent = ({ children, className, from, ...props }: MessageContentProps) => (
  <div
    className={cn(
      'flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden text-sm',
      from === 'user'
        ? 'rounded-2xl rounded-br-sm bg-user-bubble px-4 py-2.5 text-foreground'
        : 'text-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type ResponseProps = ComponentProps<typeof Streamdown>;

/** Plugins de streamdown: resaltado de código (shiki) + diagramas mermaid. */
const streamdownPlugins = { code, mermaid };

/**
 * Renderizador de respuesta del copiloto: markdown completo + diagramas mermaid
 * + resaltado de código, sobre streamdown (mismo enfoque que Mayordomo). Se
 * memoiza por `children` para no re-renderizar en cada tick del streaming.
 */
export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        'size-full space-y-3 leading-relaxed break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className,
      )}
      plugins={streamdownPlugins}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);

Response.displayName = 'Response';
