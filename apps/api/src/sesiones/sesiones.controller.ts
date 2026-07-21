import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CrearSesionInput, crearSesionInputSchema, UserRole } from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { SesionGeneratorService } from '../agent/agent.service';

@Controller('sesiones')
export class SesionesController {
  constructor(private readonly generator: SesionGeneratorService) {}

  /**
   * POST /api/sesiones/generar — genera una sesión de aprendizaje con IA,
   * la valida con el Verificador (integridad de citas + multigrado) y la
   * guarda como borrador. Solo para docentes.
   */
  @Post('generar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCENTE)
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
}
