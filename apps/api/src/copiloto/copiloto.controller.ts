import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { convertToModelMessages, UIMessage } from 'ai';
import {
  ConversacionResumen,
  CopilotoChatRequest,
  copilotoChatRequestSchema,
  IdParam,
  idParamSchema,
  MensajeResumen,
  RolMensaje,
  TranscripcionResponse,
  UserRole,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { CopilotoService } from './copiloto.service';
import { TranscripcionService } from './transcripcion.service';
import { ConversacionesService } from './conversaciones.service';

/** Multer entrega el archivo en memoria; tipamos lo justo (sin `@types/multer`). */
interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** Extrae el texto plano de un `UIMessage` (partes `type: 'text'`). */
function uiMessageText(message: unknown): string {
  const parts = (message as { parts?: Array<{ type: string; text?: string }> } | undefined)?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('\n')
    .trim();
}

/**
 * Copiloto conversacional + voz. Todo el controlador es solo para DOCENTES
 * (el admin es superusuario y pasa). El chat y la transcripción responden 503
 * si falta `OPENAI_API_KEY`; los reads de conversación funcionan igual.
 */
@Controller('copiloto')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DOCENTE)
export class CopilotoController {
  private readonly logger = new Logger(CopilotoController.name);

  constructor(
    private readonly copiloto: CopilotoService,
    private readonly transcripcion: TranscripcionService,
    private readonly conversaciones: ConversacionesService,
  ) {}

  /**
   * POST /api/copiloto/chat — copiloto conversacional en streaming (protocolo
   * UI Message Stream del AI SDK v6, consumible con `@ai-sdk/react` `useChat`).
   * Persiste el último turno del docente antes de emitir y la respuesta del
   * asistente al terminar. Devuelve el id del hilo en `X-Conversacion-Id`.
   */
  @Post('chat')
  async chat(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(copilotoChatRequestSchema)) body: CopilotoChatRequest,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.copiloto.enabled()) {
      throw new ServiceUnavailableException('El copiloto requiere OPENAI_API_KEY en el entorno.');
    }

    const messages = body.messages as UIMessage[];
    const conv = body.conversacionId
      ? await this.conversaciones.obtener(user.id, body.conversacionId)
      : await this.conversaciones.crear(user.id);

    // Persistir el último turno del docente ANTES de emitir.
    const ultimo = messages[messages.length - 1];
    const textoUsuario = uiMessageText(ultimo);
    if ((ultimo as { role?: string } | undefined)?.role === 'user' && textoUsuario) {
      await this.conversaciones.agregarMensaje(conv, RolMensaje.USER, textoUsuario);
    }

    const modelMessages = await convertToModelMessages(messages);
    const result = this.copiloto.run(user.id, modelMessages);

    // El id del hilo viaja en una cabecera para que el cliente pueda reanudar.
    res.setHeader('X-Conversacion-Id', conv.id);
    result.pipeUIMessageStreamToResponse(res);

    // Persistencia del turno del asistente al terminar (fire-and-forget: el
    // stream ya se emitió; si falla la persistencia, no rompemos la respuesta).
    void (async () => {
      try {
        const [text, toolCalls] = await Promise.all([result.text, result.toolCalls]);
        await this.conversaciones.agregarMensaje(
          conv,
          RolMensaje.ASSISTANT,
          text,
          toolCalls.length > 0 ? toolCalls : null,
        );
      } catch (err) {
        this.logger.error(`No se pudo persistir la respuesta del asistente: ${String(err)}`);
      }
    })();
  }

  /**
   * POST /api/copiloto/transcribe — transcribe un audio (campo `audio`) a texto
   * con OpenAI directo. 503 si falta `OPENAI_API_KEY`.
   */
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async transcribe(@UploadedFile() file: UploadedAudio): Promise<TranscripcionResponse> {
    if (!this.transcripcion.enabled()) {
      throw new ServiceUnavailableException(
        'La transcripción requiere OPENAI_API_KEY en el entorno.',
      );
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('No se recibió audio (campo "audio").');
    }
    const text = await this.transcripcion.transcribe(file.buffer);
    return { text };
  }

  /** POST /api/copiloto/conversaciones — abre un hilo nuevo (para reanudar luego). */
  @Post('conversaciones')
  async crearConversacion(@CurrentUser() user: User): Promise<ConversacionResumen> {
    const conv = await this.conversaciones.crear(user.id);
    return {
      id: conv.id,
      titulo: conv.titulo,
      lastAt: conv.lastAt.toISOString(),
      createdAt: conv.createdAt.toISOString(),
    };
  }

  /** GET /api/copiloto/conversaciones — hilos del docente (más reciente primero). */
  @Get('conversaciones')
  async listarConversaciones(@CurrentUser() user: User): Promise<ConversacionResumen[]> {
    const convs = await this.conversaciones.listar(user.id);
    return convs.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      lastAt: c.lastAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }));
  }

  /** GET /api/copiloto/conversaciones/:id/mensajes — historial para reanudar. */
  @Get('conversaciones/:id/mensajes')
  async listarMensajes(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<MensajeResumen[]> {
    const mensajes = await this.conversaciones.listarMensajes(user.id, params.id);
    return mensajes.map((m) => ({
      id: m.id,
      rol: m.rol,
      contenido: m.contenido,
      createdAt: m.createdAt.toISOString(),
    }));
  }
}
