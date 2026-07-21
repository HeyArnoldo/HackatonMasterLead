import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CompilarLatexInput, compilarLatexInputSchema, UserRole } from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PdfService } from './pdf.service';

/**
 * Compilación de LaTeX arbitrario a PDF. Solo DOCENTES (el admin pasa por ser
 * superusuario). El copiloto puede generar LaTeX y este endpoint lo materializa
 * en un PDF descargable. Responde 503 si tectonic no está instalado, 422 si el
 * LaTeX no compila.
 */
@Controller('pdf')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DOCENTE)
export class PdfController {
  constructor(private readonly pdf: PdfService) {}

  /** POST /api/pdf/compile — body `{ latex }` → PDF compilado (inline). */
  @Post('compile')
  async compile(
    @Body(new ZodValidationPipe(compilarLatexInputSchema)) body: CompilarLatexInput,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.pdf.compile(body.latex);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="documento.pdf"');
    res.send(pdf);
  }
}
