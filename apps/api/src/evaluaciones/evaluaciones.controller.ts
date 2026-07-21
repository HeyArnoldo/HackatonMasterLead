import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  CrearEvaluacionInput,
  crearEvaluacionInputSchema,
  EvaluacionDetalle,
  EvaluacionResumen,
  IdParam,
  idParamSchema,
  UserRole,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { EvaluacionGeneratorService } from '../agent/evaluacion.service';
import { PdfService } from '../pdf/pdf.service';
import { renderEvaluacionLatex } from '../pdf/evaluacion-latex.template';
import { EvaluacionesService } from './evaluaciones.service';

/**
 * Evaluaciones/exámenes del docente: generación con IA (Verificador-gated),
 * lectura y export a PDF. Solo DOCENTES (el admin pasa por superusuario).
 */
@Controller('evaluaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DOCENTE)
export class EvaluacionesController {
  constructor(
    private readonly generator: EvaluacionGeneratorService,
    private readonly evaluaciones: EvaluacionesService,
    private readonly pdf: PdfService,
  ) {}

  /**
   * POST /api/evaluaciones/generar — genera una evaluación con IA, la valida con
   * el Verificador (integridad de citas por ítem) y la guarda como borrador.
   */
  @Post('generar')
  async generar(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(crearEvaluacionInputSchema)) input: CrearEvaluacionInput,
  ) {
    const { evaluacion, contenido, verification } = await this.generator.generar(user.id, input);
    return {
      id: evaluacion.id,
      estado: evaluacion.estado,
      grado: evaluacion.grado,
      areaId: evaluacion.areaId,
      competenciaIds: evaluacion.competenciaIds,
      contenidoJson: contenido,
      generationAuditId: evaluacion.generationAuditId,
      createdAt: evaluacion.createdAt.toISOString(),
      verification: { valid: verification.valid, errors: verification.errors },
    };
  }

  /** GET /api/evaluaciones — evaluaciones del docente autenticado (resumen). */
  @Get()
  async listar(@CurrentUser() user: User): Promise<EvaluacionResumen[]> {
    return this.evaluaciones.listar(user.id);
  }

  /** GET /api/evaluaciones/:id — detalle completo de una evaluación propia. */
  @Get(':id')
  async obtener(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<EvaluacionDetalle> {
    return this.evaluaciones.obtener(user.id, params.id);
  }

  /**
   * GET /api/evaluaciones/:id/pdf — compila el `contenidoJson` de la evaluación
   * propia a un PDF (plantilla determinista) y lo devuelve inline.
   */
  @Get(':id/pdf')
  async pdfDeEvaluacion(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Res() res: Response,
  ): Promise<void> {
    const detalle = await this.evaluaciones.obtener(user.id, params.id);
    if (!detalle.contenidoJson) {
      throw new BadRequestException('La evaluación aún no tiene contenido para exportar a PDF.');
    }
    const latex = renderEvaluacionLatex(detalle.contenidoJson);
    const pdf = await this.pdf.compile(latex);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="evaluacion-${detalle.id}.pdf"`);
    res.send(pdf);
  }
}
