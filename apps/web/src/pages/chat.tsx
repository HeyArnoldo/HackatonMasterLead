import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import {
  ArrowUpIcon,
  Loader2Icon,
  MicIcon,
  SparklesIcon,
  SquareIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import {
  contenidoSesionSchema,
  EstadoSesion,
  type ContenidoSesion,
  type MensajeResumen,
} from '@app/contracts';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, Response } from '@/components/ai-elements/message';
import { Reasoning } from '@/components/ai-elements/reasoning';
import { Tool } from '@/components/ai-elements/tool';
import { SesionArtifact } from '@/components/sesion-artifact';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { copilotoApi, chatEndpoint } from '@/services/copiloto.api';
import { api } from '@/lib/api';

const SUGERENCIAS = [
  'Ayúdame a crear una sesión de Comunicación para 3° grado sobre la leyenda local',
  'Sesión de Matemática multigrado (2° y 3°) sobre medición con material de la comunidad',
  'Quiero una sesión de Personal Social sobre el cuidado del agua en Loreto',
];

/** Narrowing laxo de una parte de herramienta del stream (UIMessage no tipado). */
interface ToolPartLike {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function toolNameOf(part: ToolPartLike): string {
  return part.type === 'dynamic-tool' ? (part.toolName ?? 'tool') : part.type.slice('tool-'.length);
}

type ProponerOutput = { ok?: boolean; sesionId?: string; titulo?: string };

/** Extrae el contenido de sesión del input de `proponer_sesion`, si es válido. */
function sesionDePropuesta(input: unknown): ContenidoSesion | null {
  const raw = (input as { contenidoJson?: unknown } | undefined)?.contenidoJson;
  if (!raw) return null;
  const parsed = contenidoSesionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function PartsView({ parts, streaming }: { parts: UIMessage['parts']; streaming: boolean }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <Response key={i}>{part.text}</Response>;
        }
        if (part.type === 'reasoning') {
          return <Reasoning key={i} text={part.text} isStreaming={streaming} />;
        }
        if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
          const tp = part as unknown as ToolPartLike;
          const name = toolNameOf(tp);

          if (name === 'proponer_sesion') {
            const output = tp.output as ProponerOutput | undefined;
            const contenido = sesionDePropuesta(tp.input);
            if (tp.state === 'output-available' && output?.ok && contenido) {
              return (
                <SesionArtifact
                  key={i}
                  contenido={contenido}
                  estado={EstadoSesion.BORRADOR}
                  header={
                    <p className="mt-2 text-xs text-muted-foreground">
                      Guardada como borrador. Revísala en <strong>Mis sesiones</strong>.
                    </p>
                  }
                />
              );
            }
            if (tp.state === 'output-available' && output && !output.ok) {
              return (
                <p key={i} className="text-xs text-muted-foreground">
                  El verificador pidió ajustes en la sesión; el copiloto está corrigiéndola…
                </p>
              );
            }
            return (
              <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" />
                Preparando la propuesta de sesión…
              </p>
            );
          }

          return (
            <Tool
              key={i}
              name={name}
              state={tp.state ?? 'input-available'}
              input={tp.input}
              output={tp.output}
              errorText={tp.errorText}
            />
          );
        }
        return null;
      })}
    </>
  );
}

function ChatThread({
  conversacionId: initialConvId,
  initialMessages,
}: {
  conversacionId: string | null;
  initialMessages: UIMessage[];
}) {
  const chatId = useMemo(() => initialConvId ?? crypto.randomUUID(), [initialConvId]);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: chatEndpoint, credentials: 'include' }),
    [],
  );
  const { messages, sendMessage, status, error, stop } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  });

  const convIdRef = useRef<string | null>(initialConvId);
  const [input, setInput] = useState('');
  const voice = useVoiceRecorder((text) => setInput((prev) => (prev ? `${prev} ${text}` : text)));

  const busy = status === 'submitted' || status === 'streaming';

  async function ensureConversacion(): Promise<string> {
    if (convIdRef.current) return convIdRef.current;
    const conv = await copilotoApi.crearConversacion();
    convIdRef.current = conv.id;
    // Refleja el hilo en la URL sin remontar (para reanudar tras un refresh).
    window.history.replaceState(null, '', `/chat/${conv.id}`);
    return conv.id;
  }

  async function handleSend(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setInput('');
    const id = await ensureConversacion();
    sendMessage({ text: value }, { body: { conversacionId: id } });
  }

  const iaCaida =
    status === 'error' && /503|service unavailable|configur/i.test(error?.message ?? '');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<SparklesIcon className="size-8" />}
              title="Hola, soy tu copiloto Yachai"
              description="Cuéntame qué sesión de aprendizaje quieres preparar y la armamos juntos, paso a paso."
            >
              <div className="mt-2 flex max-w-xl flex-col gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void handleSend(s)}
                    className="rounded-lg border bg-card px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent from={m.role}>
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap">
                    {m.parts
                      .filter((p) => p.type === 'text')
                      .map((p) => (p.type === 'text' ? p.text : ''))
                      .join('')}
                  </p>
                ) : (
                  <PartsView parts={m.parts} streaming={busy} />
                )}
              </MessageContent>
            </Message>
          ))}

          {status === 'submitted' && (
            <Message from="assistant">
              <MessageContent from="assistant">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Pensando…
                </span>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Aviso de IA no configurada / error */}
      {status === 'error' && (
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              {iaCaida
                ? 'La IA aún no está configurada en este entorno. Cuando esté disponible podrás conversar con el copiloto.'
                : 'Ocurrió un problema al conversar con el copiloto. Intenta nuevamente.'}
            </p>
          </div>
        </div>
      )}

      {/* Barra de entrada */}
      <div className="border-t bg-background/80 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend(input);
          }}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 p-3"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend(input);
              }
            }}
            placeholder={
              voice.status === 'recording'
                ? 'Escuchando… habla y presiona el micrófono para terminar'
                : 'Escribe tu mensaje o usa el micrófono…'
            }
            rows={1}
            className="max-h-40 min-h-11 flex-1 resize-none"
          />
          <Button
            type="button"
            size="icon"
            variant={voice.status === 'recording' ? 'destructive' : 'outline'}
            onClick={voice.toggle}
            disabled={voice.status === 'transcribing'}
            title="Dictar por voz"
          >
            {voice.status === 'transcribing' ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <MicIcon className="size-4" />
            )}
          </Button>
          {busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={stop} title="Detener">
              <SquareIcon className="size-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} title="Enviar">
              <ArrowUpIcon className="size-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

/** Reanuda un hilo: carga su historial antes de montar el chat. */
function ResumedThread({ conversacionId }: { conversacionId: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [initial, setInitial] = useState<UIMessage[]>([]);

  useEffect(() => {
    let cancel = false;
    setState('loading');
    api
      .get<MensajeResumen[]>(`/copiloto/conversaciones/${conversacionId}/mensajes`)
      .then(({ data }) => {
        if (cancel) return;
        setInitial(
          data.map((m) => ({
            id: m.id,
            role: m.rol === 'assistant' ? 'assistant' : 'user',
            parts: [{ type: 'text', text: m.contenido }],
          })),
        );
        setState('ready');
      })
      .catch(() => {
        if (!cancel) setState('error');
      });
    return () => {
      cancel = true;
    };
  }, [conversacionId]);

  if (state === 'loading') {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-1/2" />
      </div>
    );
  }

  return <ChatThread conversacionId={conversacionId} initialMessages={initial} />;
}

export default function ChatPage() {
  const { conversacionId } = useParams<{ conversacionId?: string }>();

  if (conversacionId) {
    return <ResumedThread key={conversacionId} conversacionId={conversacionId} />;
  }
  return <ChatThread key="nuevo" conversacionId={null} initialMessages={[]} />;
}
