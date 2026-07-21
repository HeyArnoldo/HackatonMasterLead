import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  CompetenciaConCapacidades,
  CompetenciasQuery,
  competenciasQuerySchema,
  CurriculumArea as CurriculumAreaDto,
  UserRole,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurriculumService } from './curriculum.service';

/**
 * Lecturas del currículo que consume el frontend al construir una sesión.
 * No usan IA: funcionan aunque falte `OPENAI_API_KEY`. Solo para docentes
 * (el admin es superusuario y pasa).
 */
@Controller('curriculo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DOCENTE)
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  /** GET /api/curriculo/areas — áreas curriculares disponibles. */
  @Get('areas')
  async areas(): Promise<CurriculumAreaDto[]> {
    const areas = await this.curriculum.listarAreas();
    return areas.map((a) => ({ id: a.id, nombre: a.nombre }));
  }

  /** GET /api/curriculo/competencias?area=... — competencias + capacidades del área. */
  @Get('competencias')
  async competencias(
    @Query(new ZodValidationPipe(competenciasQuerySchema)) query: CompetenciasQuery,
  ): Promise<CompetenciaConCapacidades[]> {
    return this.curriculum.competenciasDeArea(query.area);
  }
}
