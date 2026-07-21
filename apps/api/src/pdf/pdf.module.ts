import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';

/**
 * Módulo de compilación LaTeX → PDF (tectonic). Exporta `PdfService` para que
 * las sesiones y evaluaciones rendericen sus PDFs con sus plantillas deterministas.
 */
@Module({
  providers: [PdfService],
  controllers: [PdfController],
  exports: [PdfService],
})
export class PdfModule {}
