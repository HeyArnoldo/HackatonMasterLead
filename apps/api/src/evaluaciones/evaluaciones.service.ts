import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContenidoEvaluacion, EvaluacionDetalle, EvaluacionResumen } from '@app/contracts';
import { Evaluacion } from './evaluacion.entity';

/** Lecturas de las evaluaciones del docente (listar / detalle). */
@Injectable()
export class EvaluacionesService {
  constructor(
    @InjectRepository(Evaluacion) private readonly evaluaciones: Repository<Evaluacion>,
  ) {}

  /** El título vive dentro de `contenidoJson`; lo exponemos plano para el listado. */
  private titulo(e: Evaluacion): string | null {
    const c = e.contenidoJson as { titulo?: string } | null;
    return c?.titulo ?? null;
  }

  async listar(docenteId: string): Promise<EvaluacionResumen[]> {
    const rows = await this.evaluaciones.find({
      where: { docenteId },
      order: { createdAt: 'DESC' },
      relations: { area: true },
    });
    return rows.map((e) => ({
      id: e.id,
      titulo: this.titulo(e),
      area: e.area?.nombre ?? null,
      grado: e.grado,
      estado: e.estado,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async obtener(docenteId: string, id: string): Promise<EvaluacionDetalle> {
    const e = await this.evaluaciones.findOne({
      where: { id, docenteId },
      relations: { area: true },
    });
    if (!e) throw new NotFoundException('Evaluación no encontrada.');
    return {
      id: e.id,
      titulo: this.titulo(e),
      area: e.area?.nombre ?? null,
      areaId: e.areaId,
      grado: e.grado,
      competenciaIds: e.competenciaIds,
      estado: e.estado,
      contenidoJson: (e.contenidoJson as ContenidoEvaluacion | null) ?? null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }
}
