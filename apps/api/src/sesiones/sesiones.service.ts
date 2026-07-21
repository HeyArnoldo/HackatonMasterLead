import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActualizarSesionInput,
  ContenidoSesion,
  SesionDetalle,
  SesionResumen,
} from '@app/contracts';
import { SesionAprendizaje } from './sesion-aprendizaje.entity';
import { CurriculumArea } from '../curriculum/curriculum-area.entity';

/** Lecturas y edición de las sesiones del docente (listar / detalle / actualizar). */
@Injectable()
export class SesionesService {
  constructor(
    @InjectRepository(SesionAprendizaje) private readonly sesiones: Repository<SesionAprendizaje>,
    @InjectRepository(CurriculumArea) private readonly areas: Repository<CurriculumArea>,
  ) {}

  /** El título vive dentro de `contenidoJson`; lo exponemos plano para el listado. */
  private titulo(s: SesionAprendizaje): string | null {
    const c = s.contenidoJson as { titulo?: string } | null;
    return c?.titulo ?? null;
  }

  async listar(docenteId: string): Promise<SesionResumen[]> {
    const rows = await this.sesiones.find({
      where: { docenteId },
      order: { createdAt: 'DESC' },
      relations: { area: true },
    });
    return rows.map((s) => ({
      id: s.id,
      titulo: this.titulo(s),
      area: s.area?.nombre ?? null,
      grados: s.grados,
      estado: s.estado,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async obtener(docenteId: string, id: string): Promise<SesionDetalle> {
    const s = await this.sesiones.findOne({
      where: { id, docenteId },
      relations: { area: true },
    });
    if (!s) throw new NotFoundException('Sesión no encontrada.');
    return this.toDetalle(s);
  }

  /** Actualiza `contenidoJson` y/o `estado` (borrador → final) de una sesión propia. */
  async actualizar(
    docenteId: string,
    id: string,
    input: ActualizarSesionInput,
  ): Promise<SesionDetalle> {
    const s = await this.sesiones.findOne({
      where: { id, docenteId },
      relations: { area: true },
    });
    if (!s) throw new NotFoundException('Sesión no encontrada.');

    if (input.contenidoJson !== undefined) s.contenidoJson = input.contenidoJson;
    if (input.estado !== undefined) s.estado = input.estado;

    const saved = await this.sesiones.save(s);
    // `save` no rehidrata la relación; la resolvemos para la respuesta.
    if (!saved.area && saved.areaId) {
      saved.area = await this.areas.findOne({ where: { id: saved.areaId } });
    }
    return this.toDetalle(saved);
  }

  private toDetalle(s: SesionAprendizaje): SesionDetalle {
    return {
      id: s.id,
      titulo: this.titulo(s),
      area: s.area?.nombre ?? null,
      areaId: s.areaId,
      grados: s.grados,
      competenciaIds: s.competenciaIds,
      lengua: s.lengua,
      contexto: s.contexto,
      estado: s.estado,
      contenidoJson: (s.contenidoJson as ContenidoSesion | null) ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
