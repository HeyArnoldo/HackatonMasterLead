import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CompetenciaConCapacidades } from '@app/contracts';
import { CurriculumArea } from './curriculum-area.entity';
import { Competencia } from './competencia.entity';
import { Capacidad } from './capacidad.entity';

/** Lecturas del currículo para el frontend (áreas y árbol de competencias). */
@Injectable()
export class CurriculumService {
  constructor(
    @InjectRepository(CurriculumArea) private readonly areas: Repository<CurriculumArea>,
    @InjectRepository(Competencia) private readonly competencias: Repository<Competencia>,
    @InjectRepository(Capacidad) private readonly capacidades: Repository<Capacidad>,
  ) {}

  /** Áreas curriculares (orden alfabético). */
  async listarAreas(): Promise<CurriculumArea[]> {
    return this.areas.find({ order: { nombre: 'ASC' } });
  }

  /**
   * Competencias (con sus capacidades) de un área, resuelta por nombre
   * (case-insensitive). Devuelve `[]` si el área no existe.
   */
  async competenciasDeArea(area: string): Promise<CompetenciaConCapacidades[]> {
    const found = await this.areas
      .createQueryBuilder('a')
      .where('LOWER(a.nombre) = LOWER(:nombre)', { nombre: area.trim() })
      .getOne();
    if (!found) return [];

    const comps = await this.competencias.find({
      where: { areaId: found.id },
      order: { codigo: 'ASC' },
    });
    const caps = comps.length
      ? await this.capacidades.find({
          where: { competenciaId: In(comps.map((c) => c.id)) },
          order: { codigo: 'ASC' },
        })
      : [];

    return comps.map((c) => ({
      id: c.id,
      areaId: c.areaId,
      codigo: c.codigo,
      nombre: c.nombre,
      capacidades: caps
        .filter((cap) => cap.competenciaId === c.id)
        .map((cap) => ({ id: cap.id, codigo: cap.codigo, nombre: cap.nombre })),
    }));
  }
}
