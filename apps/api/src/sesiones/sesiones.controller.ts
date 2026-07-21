import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ActualizarSesionInput,
  actualizarSesionInputSchema,
  CrearSesionInput,
  crearSesionInputSchema,
  IdParam,
  idParamSchema,
  SesionDetalle,
  SesionResumen,
  UserRole,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { SesionGeneratorService } from '../agent/agent.service';
import { PdfService } from '../pdf/pdf.service';
import { renderSesionLatex } from '../pdf/sesion-latex.template';
import { SesionesService } from './sesiones.service';

@Controller('sesiones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DOCENTE)
export class SesionesController {
  constructor(
    private readonly generator: SesionGeneratorService,
    private readonly sesiones: SesionesService,
    private readonly pdf: PdfService,
  ) {}

  /**
   * POST /api/sesiones/generar — genera una sesión de aprendizaje con IA,
   * la valida con el Verificador (integridad de citas + multigrado) y la
   * guarda como borrador. Solo para docentes.
   */
  @Post('generar')
  async generar(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(crearSesionInputSchema)) input: CrearSesionInput,
  ) {
    const { sesion, contenido, verification } = await this.generator.generar(user.id, input);
    return {
      id: sesion.id,
      estado: sesion.estado,
      grados: sesion.grados,
      areaId: sesion.areaId,
      competenciaIds: sesion.competenciaIds,
      lengua: sesion.lengua,
      contexto: sesion.contexto,
      contenidoJson: contenido,
      generationAuditId: sesion.generationAuditId,
      createdAt: sesion.createdAt.toISOString(),
      verification: { valid: verification.valid, errors: verification.errors },
    };
  }

  /** GET /api/sesiones — sesiones del docente autenticado (resumen). */
  @Get()
  async listar(@CurrentUser() user: User): Promise<SesionResumen[]> {
    return this.sesiones.listar(user.id);
  }

  /** GET /api/sesiones/:id — detalle completo (contenidoJson) de una sesión propia. */
  @Get(':id')
  async obtener(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<SesionDetalle> {
    return this.sesiones.obtener(user.id, params.id);
  }

  /**
   * GET /api/sesiones/:id/pdf — compila el `contenidoJson` de la sesión propia
   * a un PDF (plantilla determinista) y lo devuelve inline. 404 si no es propia,
   * 400 si aún no tiene contenido, 503 si tectonic no está instalado.
   */
  @Get(':id/pdf')
  async pdfDeSesion(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Res() res: Response,
  ): Promise<void> {
    const detalle = await this.sesiones.obtener(user.id, params.id);
    if (!detalle.contenidoJson) {
      throw new BadRequestException('La sesión aún no tiene contenido para exportar a PDF.');
    }
    const latex = renderSesionLatex(detalle.contenidoJson);
    const pdf = await this.pdf.compile(latex);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="sesion-${detalle.id}.pdf"`);
    res.send(pdf);
  }

  /** PATCH /api/sesiones/:id — actualiza contenidoJson y/o estado (borrador → final). */
  @Patch(':id')
  async actualizar(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(actualizarSesionInputSchema)) input: ActualizarSesionInput,
  ): Promise<SesionDetalle> {
    return this.sesiones.actualizar(user.id, params.id, input);
  }
}
