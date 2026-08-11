import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Tabla personas (Modelo de Datos §3.1) — entidad principal del sistema.
 *
 * Fidelidad al modelo: todos los campos son opcionales a nivel de esquema.
 * La obligatoriedad de primerNombre/curp/fechaNacimiento (DP-007) se aplica
 * en la capa de validación del backend (pendiente P1 del plan).
 *
 * `edad` NO se persiste: se calcula desde fechaNacimiento (RF-GEN-008).
 * `genero` y `estadoCivil` están declarados ENUM en el modelo pero sin
 * valores definidos (pendiente P3): se persisten como VARCHAR y la lista
 * de valores se validará en la aplicación al aprobarse.
 */
@Entity('personas')
export class Persona {
  @PrimaryColumn('uuid')
  idPersona!: string;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  primerNombre?: string;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  apellidoPaterno?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  apellidoMaterno?: string;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento?: string;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  alias?: string;

  @Index()
  @Column({ type: 'varchar', length: 18, nullable: true })
  curp?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  genero?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  estadoCivil?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nivelEducativo?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ocupacion?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nacionalidad?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  estadoNacimiento?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  numeroTelefono?: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idPersona) this.idPersona = uuidv7();
  }

  /** Edad calculada — nunca persistida (RF-GEN-008). */
  get edad(): number | null {
    if (!this.fechaNacimiento) return null;
    const nacimiento = new Date(this.fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad;
  }
}

/** Tabla domicilios (§3.2): una persona puede registrar múltiples domicilios. */
@Entity('domicilios')
export class Domicilio {
  @PrimaryColumn('uuid')
  idDomicilio!: string;

  @Index()
  @Column({ type: 'uuid' })
  idPersona!: string;

  @Column({ type: 'varchar', length: 150 })
  calle!: string;

  // Admite valores alfanuméricos como "12-A", "45 BIS" o "S/N" (RF-PER-007).
  @Column({ type: 'varchar', length: 30, nullable: true })
  numeroExterior?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  numeroInterior?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  cruce1?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  cruce2?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  colonia?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  estado?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  municipio?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  pais?: string;

  // Coordenadas del domicilio capturadas desde el mapa (decisión del equipo
  // 2026-08-11, fuera del Modelo de Datos v1.0 — registrada en el PLAN).
  @Column({ type: 'double precision', nullable: true })
  latitud?: number;

  @Column({ type: 'double precision', nullable: true })
  longitud?: number;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idDomicilio) this.idDomicilio = uuidv7();
  }
}

/**
 * Tabla elementos (§3.3) — padrón reutilizable. Antes de crear uno debe
 * buscarse por numeroElemento y después por nombre completo + adscripcion
 * (RF-ELE-001); solo se crea con confirmación del usuario (RF-ELE-002).
 * numeroElemento es VARCHAR(50): conserva ceros iniciales y alfanuméricos.
 */
@Entity('elementos')
export class Elemento {
  @PrimaryColumn('uuid')
  idElemento!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  grado?: string;

  @Column({ type: 'varchar', length: 100 })
  primerNombre!: string;

  @Column({ type: 'varchar', length: 100 })
  apellidoPaterno!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  apellidoMaterno?: string;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  numeroElemento?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  adscripcion?: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idElemento) this.idElemento = uuidv7();
  }
}
