import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, ObjectType } from 'typeorm';
import { BusinessRuleException, EntityNotFoundException } from '@icms/common';

/**
 * Valida referencias de catálogo en el backend (RF-GEN-004): la FK debe
 * existir y estar ACTIVA para usarse en registros nuevos (RF-IEG-003,
 * RF-MOV-002, RF-AUD-003...). Los históricos conservan valores inactivos.
 */
@Injectable()
export class ValidadorCatalogos {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async asegurarActivo<T extends { activo?: boolean; nombre?: string }>(
    entidad: ObjectType<T>,
    pk: string,
    id: string,
    etiqueta: string,
  ): Promise<T> {
    const fila = (await this.dataSource
      .getRepository(entidad)
      .findOne({ where: { [pk]: id } as never })) as T | null;
    if (!fila) throw new EntityNotFoundException(etiqueta, id);
    if (fila.activo === false) {
      throw new BusinessRuleException(`${etiqueta} "${fila.nombre ?? id}" está inactivo y no admite registros nuevos`);
    }
    return fila;
  }
}
