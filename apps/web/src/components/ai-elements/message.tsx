import type { HTMLAttributes, ReactNode } from 'react';
import { Fragment, memo } from 'react';
import type { UIMessage } from 'ai';
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
        ? 'rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground'
        : 'text-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

/** Parseo inline mínimo: **negrita** y `código`. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-c-${i}`} className="rounded bg-muted px-1 py-0.5 text-xs">
          {match[3]}
        </code>,
      );
    }
    last = match.index + match[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Renderizador de respuesta ligero (markdown-lite): párrafos, listas y
 * encabezados. Evita traer un motor de markdown pesado — el copiloto responde
 * en prosa conversacional corta.
 */
export const Response = memo(({ children }: { children: string }) => {
  const blocks = children.split(/\n{2,}/);
  return (
    <div className="space-y-3 leading-relaxed break-words">
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const isBullets = lines.every((l) => /^\s*[-*]\s+/.test(l));
        const isNumbered = lines.every((l) => /^\s*\d+\.\s+/.test(l));

        if (isBullets && lines.length > 0) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-*]\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (isNumbered && lines.length > 0) {
          return (
            <ol key={bi} className="list-decimal space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*\d+\.\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        }
        const heading = /^(#{1,3})\s+(.*)$/.exec(block);
        if (heading) {
          return (
            <p key={bi} className="font-semibold">
              {renderInline(heading[2] ?? '', `h-${bi}`)}
            </p>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {renderInline(l, `${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
});

Response.displayName = 'Response';
