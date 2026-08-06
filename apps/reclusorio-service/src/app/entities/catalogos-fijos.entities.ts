import { BeforeInsert, Column, Entity, PrimaryColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Catálogos FIJOS (Modelo de Datos §6). Sus valores forman parte de las
 * reglas del sistema: no se muestran en la administración general y solo
 * cambian mediante una actualización controlada (RF-CAT-008/009).
 * Estructura común: PK UUID propia, nombre, orden y activo.
 */
abstract class CatalogoFijoBase {
  @Column({ type: 'varchar', length: 255 })
  nombre!: string;

  @Column({ type: 'integer' })
  orden!: number;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;
}

@Entity('tipo_ingreso_egreso')
export class TipoIngresoEgreso extends CatalogoFijoBase {
  @PrimaryColumn('uuid')
  idTipoIngresoEgreso!: string;

  @Column({ type: 'varchar', length: 50 })
  override nombre!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idTipoIngresoEgreso) this.idTipoIngresoEgreso = uuidv7();
  }
}

@Entity('tipo_movimientos')
export class TipoMovimiento extends CatalogoFijoBase {
  @PrimaryColumn('uuid')
  idTipoMovimiento!: string;

  @Column({ type: 'varchar', length: 100 })
  override nombre!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idTipoMovimiento) this.idTipoMovimiento = uuidv7();
  }
}

@Entity('motivo_movimiento')
export class MotivoMovimiento extends CatalogoFijoBase {
  @PrimaryColumn('uuid')
  idMotivoMovimiento!: string;

  @Column({ type: 'varchar', length: 150 })
  override nombre!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idMotivoMovimiento) this.idMotivoMovimiento = uuidv7();
  }
}

@Entity('forma_ingreso_audiencia')
export class FormaIngresoAudiencia extends CatalogoFijoBase {
  @PrimaryColumn('uuid')
  idFormaIngresoAudiencia!: string;

  @Column({ type: 'varchar', length: 150 })
  override nombre!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idFormaIngresoAudiencia) this.idFormaIngresoAudiencia = uuidv7();
  }
}

@Entity('resolucion_audiencia')
export class ResolucionAudiencia extends CatalogoFijoBase {
  @PrimaryColumn('uuid')
  idResolucionAudiencia!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idResolucionAudiencia) this.idResolucionAudiencia = uuidv7();
  }
}

@Entity('modalidad_audiencia')
export class ModalidadAudiencia extends CatalogoFijoBase {
  @PrimaryColumn('uuid')
  idModalidadAudiencia!: string;

  @Column({ type: 'varchar', length: 100 })
  override nombre!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idModalidadAudiencia) this.idModalidadAudiencia = uuidv7();
  }
}

@Entity('proxima_audiencia')
export class ProximaAudiencia extends CatalogoFijoBase {
  @PrimaryColumn('uuid')
  idProximaAudiencia!: string;

  @Column({ type: 'varchar', length: 20 })
  override nombre!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idProximaAudiencia) this.idProximaAudiencia = uuidv7();
  }
}

@Entity('tipo_traslado')
export class TipoTraslado extends CatalogoFijoBase {
  @PrimaryColumn('uuid')
  idTipoTraslado!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idTipoTraslado) this.idTipoTraslado = uuidv7();
  }
}

@Entity('estatus_traslado')
export class EstatusTraslado extends CatalogoFijoBase {
  @PrimaryColumn('uuid')
  idEstatusTraslado!: string;

  @Column({ type: 'varchar', length: 100 })
  override nombre!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idEstatusTraslado) this.idEstatusTraslado = uuidv7();
  }
}

export const CATALOGOS_FIJOS = [
  TipoIngresoEgreso,
  TipoMovimiento,
  MotivoMovimiento,
  FormaIngresoAudiencia,
  ResolucionAudiencia,
  ModalidadAudiencia,
  ProximaAudiencia,
  TipoTraslado,
  EstatusTraslado,
];
