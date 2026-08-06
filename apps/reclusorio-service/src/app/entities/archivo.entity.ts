import { BeforeInsert, Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Tabla archivos (§3.4): metadatos de fotografías, PDFs y multimedia.
 * El contenido físico vive en object storage (MinIO); rutaAlmacenamiento
 * identifica el objeto y hashSha256 valida su integridad (RF-ARC-001/006).
 *
 * Regla de EXCLUSIVIDAD (RF-ARC-003): exactamente UNA de las seis
 * referencias debe tener valor. Se aplica en dos capas: CHECK en la BD
 * (num_nonnulls = 1) y validación en el backend.
 */
@Entity('archivos')
@Check(
  'chk_archivos_referencia_exclusiva',
  `num_nonnulls("idPersona", "idIngresoEgreso", "idMovimiento", "idAudiencia", "idTraslado", "idIncidencia") = 1`,
)
export class Archivo {
  @PrimaryColumn('uuid')
  idArchivo!: string;

  @Column({ type: 'varchar', length: 255 })
  nombreOriginal!: string;

  @Column({ type: 'varchar', length: 255 })
  nombreAlmacenado!: string;

  // FOTO, PDF, DOCUMENTO u otro tipo permitido.
  @Column({ type: 'varchar', length: 50 })
  tipoArchivo!: string;

  @Column({ type: 'varchar', length: 150 })
  mimeType!: string;

  @Column({ type: 'varchar', length: 20 })
  extension!: string;

  @Column({ type: 'bigint' })
  tamanoBytes!: number;

  @Column({ type: 'varchar', length: 1000 })
  rutaAlmacenamiento!: string;

  @Column({ type: 'varchar', length: 64 })
  hashSha256!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaRegistro!: Date;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  idPersona?: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  idIngresoEgreso?: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  idMovimiento?: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  idAudiencia?: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  idTraslado?: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  idIncidencia?: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idArchivo) this.idArchivo = uuidv7();
  }
}
