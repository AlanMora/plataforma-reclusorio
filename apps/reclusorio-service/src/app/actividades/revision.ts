import { Repository } from 'typeorm';
import { BusinessRuleException, EntityNotFoundException } from '@icms/common';

/**
 * Validación inicial de registros (P10): todo ingreso/libertad, movimiento,
 * audiencia, traslado e incidencia nace PENDIENTE y el capturista lo
 * CONFIRMA o DESCARTA una única vez. Por seguridad los registros no se
 * modifican después: el estado queda persistido para identificar a futuro
 * elementos creados con posibles errores.
 */
export type EstadoRevision = 'CONFIRMADO' | 'DESCARTADO';

export async function marcarRevision(
  repo: Repository<object>,
  pk: string,
  id: string,
  estado: EstadoRevision,
  etiqueta: string,
): Promise<object> {
  const registro = (await repo.findOne({ where: { [pk]: id } as never })) as
    | (Record<string, unknown> & { estadoRevision?: string })
    | null;
  if (!registro) throw new EntityNotFoundException(etiqueta, id);
  if (registro.estadoRevision !== 'PENDIENTE') {
    throw new BusinessRuleException(
      `El registro ya fue ${String(registro.estadoRevision).toLowerCase()}; la validación se aplica una sola vez y los registros no se modifican`,
    );
  }
  registro['estadoRevision'] = estado;
  return repo.save(registro);
}
