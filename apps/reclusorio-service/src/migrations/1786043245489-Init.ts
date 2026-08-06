import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1786043245489 implements MigrationInterface {
    name = 'Init1786043245489'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "personas" ("idPersona" uuid NOT NULL, "primerNombre" character varying(150), "apellidoPaterno" character varying(150), "apellidoMaterno" character varying(150), "fechaNacimiento" date, "alias" character varying(150), "curp" character varying(18), "genero" character varying(50), "estadoCivil" character varying(50), "nivelEducativo" character varying(50), "ocupacion" character varying(50), "nacionalidad" character varying(255), "estadoNacimiento" character varying(255), "numeroTelefono" character varying(50), CONSTRAINT "PK_9ecd55bdaa6489d4e6f8cdc627d" PRIMARY KEY ("idPersona"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ca7f9046bd432ca387e05ddfe0" ON "personas" ("primerNombre") `);
        await queryRunner.query(`CREATE INDEX "IDX_9399e717cdfa10d27147e26553" ON "personas" ("apellidoPaterno") `);
        await queryRunner.query(`CREATE INDEX "IDX_64455679da93be0ef9932d756d" ON "personas" ("alias") `);
        await queryRunner.query(`CREATE INDEX "IDX_70473df0ca2bfcbbd867f2dc14" ON "personas" ("curp") `);
        await queryRunner.query(`CREATE TABLE "domicilios" ("idDomicilio" uuid NOT NULL, "idPersona" uuid NOT NULL, "calle" character varying(150) NOT NULL, "numeroExterior" character varying(30), "numeroInterior" character varying(30), "cruce1" character varying(150), "cruce2" character varying(150), "colonia" character varying(150), "estado" character varying(150), "municipio" character varying(150), "pais" character varying(150), CONSTRAINT "PK_8211fe49b3c0f036365ee2dcf87" PRIMARY KEY ("idDomicilio"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e7f154b3e55ba9be6eaf4f844a" ON "domicilios" ("idPersona") `);
        await queryRunner.query(`CREATE TABLE "elementos" ("idElemento" uuid NOT NULL, "grado" character varying(50), "primerNombre" character varying(100) NOT NULL, "apellidoPaterno" character varying(100) NOT NULL, "apellidoMaterno" character varying(100), "numeroElemento" character varying(50), "adscripcion" character varying(255), CONSTRAINT "PK_908f16720c6020b2474d154b9f8" PRIMARY KEY ("idElemento"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c494230f7e779287c8c2f2080c" ON "elementos" ("numeroElemento") `);
        await queryRunner.query(`CREATE TABLE "tipo_ingreso_egreso" ("nombre" character varying(255) NOT NULL, "orden" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true, "idTipoIngresoEgreso" uuid NOT NULL, CONSTRAINT "PK_24c6a28197b33549eb0fa9f56ad" PRIMARY KEY ("idTipoIngresoEgreso"))`);
        await queryRunner.query(`CREATE TABLE "tipo_movimientos" ("nombre" character varying(255) NOT NULL, "orden" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true, "idTipoMovimiento" uuid NOT NULL, CONSTRAINT "PK_4d1cfa26c24f34124a0e9a0be06" PRIMARY KEY ("idTipoMovimiento"))`);
        await queryRunner.query(`CREATE TABLE "motivo_movimiento" ("nombre" character varying(255) NOT NULL, "orden" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true, "idMotivoMovimiento" uuid NOT NULL, CONSTRAINT "PK_79e009942443ff7de34e9959c62" PRIMARY KEY ("idMotivoMovimiento"))`);
        await queryRunner.query(`CREATE TABLE "forma_ingreso_audiencia" ("nombre" character varying(255) NOT NULL, "orden" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true, "idFormaIngresoAudiencia" uuid NOT NULL, CONSTRAINT "PK_df9f2a3813147b34cb12a9d570a" PRIMARY KEY ("idFormaIngresoAudiencia"))`);
        await queryRunner.query(`CREATE TABLE "resolucion_audiencia" ("nombre" character varying(255) NOT NULL, "orden" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true, "idResolucionAudiencia" uuid NOT NULL, CONSTRAINT "PK_b91e316a602a79e556e2d4b95a1" PRIMARY KEY ("idResolucionAudiencia"))`);
        await queryRunner.query(`CREATE TABLE "modalidad_audiencia" ("nombre" character varying(255) NOT NULL, "orden" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true, "idModalidadAudiencia" uuid NOT NULL, CONSTRAINT "PK_76305ca0421ff3da3eeb5c9683d" PRIMARY KEY ("idModalidadAudiencia"))`);
        await queryRunner.query(`CREATE TABLE "proxima_audiencia" ("nombre" character varying(255) NOT NULL, "orden" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true, "idProximaAudiencia" uuid NOT NULL, CONSTRAINT "PK_d087424742700a04e67787ceb47" PRIMARY KEY ("idProximaAudiencia"))`);
        await queryRunner.query(`CREATE TABLE "tipo_traslado" ("nombre" character varying(255) NOT NULL, "orden" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true, "idTipoTraslado" uuid NOT NULL, CONSTRAINT "PK_9f2d41c1dd44acff2e3a93053cc" PRIMARY KEY ("idTipoTraslado"))`);
        await queryRunner.query(`CREATE TABLE "estatus_traslado" ("nombre" character varying(255) NOT NULL, "orden" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true, "idEstatusTraslado" uuid NOT NULL, CONSTRAINT "PK_a452c91818b9ef8f203d87ca5b2" PRIMARY KEY ("idEstatusTraslado"))`);
        await queryRunner.query(`CREATE TABLE "incidencias" ("idIncidencia" uuid NOT NULL, "idCentroPenitenciario" uuid NOT NULL, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, "idTipoIncidencia" uuid NOT NULL, "descripcion" character varying(2000) NOT NULL, "iph" character varying(100), "primerRespondiente" character varying(255), "narrativa" text, CONSTRAINT "PK_faaffd4d39e62c23ef36cc2ded0" PRIMARY KEY ("idIncidencia"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8de13987c63e0265ea17ed8644" ON "incidencias" ("idCentroPenitenciario") `);
        await queryRunner.query(`CREATE TABLE "incidencias_personas" ("idIncidencia" uuid NOT NULL, "idPersona" uuid NOT NULL, CONSTRAINT "PK_b55af2e85626b42f7f481ea1c91" PRIMARY KEY ("idIncidencia", "idPersona"))`);
        await queryRunner.query(`CREATE TABLE "incidencias_autoridades" ("idIncidencia" uuid NOT NULL, "idAutoridad" uuid NOT NULL, CONSTRAINT "PK_a8f4770ee65ab8ce30228bbca1e" PRIMARY KEY ("idIncidencia", "idAutoridad"))`);
        await queryRunner.query(`CREATE TABLE "incidencias_elementos" ("idIncidencia" uuid NOT NULL, "idElemento" uuid NOT NULL, "primerRespondiente" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_d9c584926730847d90d232fa21c" PRIMARY KEY ("idIncidencia", "idElemento"))`);
        await queryRunner.query(`CREATE TABLE "delitos" ("nombre" character varying(255) NOT NULL, "descripcion" character varying(500), "activo" boolean NOT NULL DEFAULT true, "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaActualizacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idDelito" uuid NOT NULL, CONSTRAINT "PK_70a6912bde794235da46d926f8a" PRIMARY KEY ("idDelito"))`);
        await queryRunner.query(`CREATE TABLE "centros" ("nombre" character varying(255) NOT NULL, "descripcion" character varying(500), "activo" boolean NOT NULL DEFAULT true, "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaActualizacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idCentro" uuid NOT NULL, CONSTRAINT "PK_362a2398fb864b9e617af285cec" PRIMARY KEY ("idCentro"))`);
        await queryRunner.query(`CREATE TABLE "juzgados" ("nombre" character varying(255) NOT NULL, "descripcion" character varying(500), "activo" boolean NOT NULL DEFAULT true, "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaActualizacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idJuzgado" uuid NOT NULL, CONSTRAINT "PK_23c107d9e237a98b214d3c655b9" PRIMARY KEY ("idJuzgado"))`);
        await queryRunner.query(`CREATE TABLE "juez_juzgados" ("nombre" character varying(255) NOT NULL, "descripcion" character varying(500), "activo" boolean NOT NULL DEFAULT true, "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaActualizacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idJuezJuzgado" uuid NOT NULL, CONSTRAINT "PK_d324318eaf3d48d9a8f896331bf" PRIMARY KEY ("idJuezJuzgado"))`);
        await queryRunner.query(`CREATE TABLE "destino_traslado" ("nombre" character varying(255) NOT NULL, "descripcion" character varying(500), "activo" boolean NOT NULL DEFAULT true, "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaActualizacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idDestinoTraslado" uuid NOT NULL, CONSTRAINT "PK_b04eeb2d5b886377e04226e7e72" PRIMARY KEY ("idDestinoTraslado"))`);
        await queryRunner.query(`CREATE TABLE "tipo_audiencia" ("nombre" character varying(255) NOT NULL, "descripcion" character varying(500), "activo" boolean NOT NULL DEFAULT true, "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaActualizacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idTipoAudiencia" uuid NOT NULL, CONSTRAINT "PK_dd4a7fe35fd414329c926ac6e09" PRIMARY KEY ("idTipoAudiencia"))`);
        await queryRunner.query(`CREATE TABLE "tipo_incidencia" ("nombre" character varying(255) NOT NULL, "descripcion" character varying(500), "activo" boolean NOT NULL DEFAULT true, "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaActualizacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idTipoIncidencia" uuid NOT NULL, CONSTRAINT "PK_6bcbd03e0e1dac8ee1f9c3de375" PRIMARY KEY ("idTipoIncidencia"))`);
        await queryRunner.query(`CREATE TABLE "autoridad" ("nombre" character varying(255) NOT NULL, "descripcion" character varying(500), "activo" boolean NOT NULL DEFAULT true, "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaActualizacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idAutoridad" uuid NOT NULL, CONSTRAINT "PK_cfbf8ec86d75d5e8ac4bee98f2c" PRIMARY KEY ("idAutoridad"))`);
        await queryRunner.query(`CREATE TABLE "ingreso_egreso" ("idIngresoEgreso" uuid NOT NULL, "idPersona" uuid NOT NULL, "idTipoIngresoEgreso" uuid NOT NULL, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, "idCentroPenitenciario" uuid NOT NULL, "ubicacion" character varying(255), "autoridad" character varying(255), "idDelito" uuid, CONSTRAINT "PK_10e0ddf48acea195a899ebe473c" PRIMARY KEY ("idIngresoEgreso"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7c809a10fc0f22fe071c938b4b" ON "ingreso_egreso" ("idPersona") `);
        await queryRunner.query(`CREATE TABLE "movimientos" ("idMovimiento" uuid NOT NULL, "idPersona" uuid NOT NULL, "idTipoMovimiento" uuid NOT NULL, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, "idCentroOrigen" uuid NOT NULL, "idCentroDestino" uuid NOT NULL, "ubicacion" character varying(255), "idMotivoMovimiento" uuid NOT NULL, CONSTRAINT "PK_ffee9b2468105d88941c6dd7cd1" PRIMARY KEY ("idMovimiento"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9a31a1554bd056acd9f72901e4" ON "movimientos" ("idPersona") `);
        await queryRunner.query(`CREATE TABLE "audiencias" ("idAudiencia" uuid NOT NULL, "idPersona" uuid NOT NULL, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, "ca" character varying(100), "ci" character varying(100), "idFormaIngresoAudiencia" uuid NOT NULL, "idJuzgado" uuid NOT NULL, "idJuezJuzgado" uuid NOT NULL, "nombreJuez" character varying(255), "idTipoAudiencia" uuid NOT NULL, "idModalidadAudiencia" uuid NOT NULL, "idResolucionAudiencia" uuid, "observaciones" character varying(2000), "idProximaAudiencia" uuid NOT NULL, "fechaSiguienteAudiencia" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3bdb96d65637287b1ef104f073" PRIMARY KEY ("idAudiencia"))`);
        await queryRunner.query(`CREATE INDEX "IDX_82abfae91aa418ab587be283ff" ON "audiencias" ("idPersona") `);
        await queryRunner.query(`CREATE TABLE "traslados" ("idTraslado" uuid NOT NULL, "idPersona" uuid NOT NULL, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, "idTipoTraslado" uuid NOT NULL, "idDestinoTraslado" uuid NOT NULL, "descripcion" character varying(2000), "unidades" character varying(255), "observaciones" character varying(2000), "idEstatusTraslado" uuid NOT NULL, CONSTRAINT "PK_9cb69dcbaad571502b2bf761e94" PRIMARY KEY ("idTraslado"))`);
        await queryRunner.query(`CREATE INDEX "IDX_eb4673cfe6fe2f95a48df5a15c" ON "traslados" ("idPersona") `);
        await queryRunner.query(`CREATE TABLE "audiencias_elementos" ("idAudiencia" uuid NOT NULL, "idElemento" uuid NOT NULL, CONSTRAINT "PK_9db047ad60f0fa8f4fa6d034318" PRIMARY KEY ("idAudiencia", "idElemento"))`);
        await queryRunner.query(`CREATE TABLE "traslados_elementos" ("idTraslado" uuid NOT NULL, "idElemento" uuid NOT NULL, CONSTRAINT "PK_25badbf1b3f2dbea13fa19f21ed" PRIMARY KEY ("idTraslado", "idElemento"))`);
        await queryRunner.query(`CREATE TABLE "archivos" ("idArchivo" uuid NOT NULL, "nombreOriginal" character varying(255) NOT NULL, "nombreAlmacenado" character varying(255) NOT NULL, "tipoArchivo" character varying(50) NOT NULL, "mimeType" character varying(150) NOT NULL, "extension" character varying(20) NOT NULL, "tamanoBytes" bigint NOT NULL, "rutaAlmacenamiento" character varying(1000) NOT NULL, "hashSha256" character varying(64) NOT NULL, "descripcion" character varying(500), "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "activo" boolean NOT NULL DEFAULT true, "idPersona" uuid, "idIngresoEgreso" uuid, "idMovimiento" uuid, "idAudiencia" uuid, "idTraslado" uuid, "idIncidencia" uuid, CONSTRAINT "chk_archivos_referencia_exclusiva" CHECK (num_nonnulls("idPersona", "idIngresoEgreso", "idMovimiento", "idAudiencia", "idTraslado", "idIncidencia") = 1), CONSTRAINT "PK_81f38332f81e2af21559da830ce" PRIMARY KEY ("idArchivo"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9a9cb95b01883d29d3194ccdab" ON "archivos" ("idPersona") `);
        await queryRunner.query(`CREATE INDEX "IDX_1bfd21046ddcdb868c2695c4d2" ON "archivos" ("idIngresoEgreso") `);
        await queryRunner.query(`CREATE INDEX "IDX_0ca8ab547eb0bf4d01eef2e152" ON "archivos" ("idMovimiento") `);
        await queryRunner.query(`CREATE INDEX "IDX_43a94ad45e761394c4f019e6a0" ON "archivos" ("idAudiencia") `);
        await queryRunner.query(`CREATE INDEX "IDX_c33a2849c21a11cfc65fdb3f19" ON "archivos" ("idTraslado") `);
        await queryRunner.query(`CREATE INDEX "IDX_3f8edbcc756bbbc7a31e2d8521" ON "archivos" ("idIncidencia") `);
        await queryRunner.query(`CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "routing_key" character varying NOT NULL, "event" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_733fafe6b0ec20ec7c93fdbbca" ON "outbox_events" ("status") `);
        await queryRunner.query(`CREATE TABLE "inbox_events" ("eventId" uuid NOT NULL, "consumer" character varying NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a23c9e45f9b8dbcd23c91e2a855" PRIMARY KEY ("eventId", "consumer"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "inbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_733fafe6b0ec20ec7c93fdbbca"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f8edbcc756bbbc7a31e2d8521"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c33a2849c21a11cfc65fdb3f19"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_43a94ad45e761394c4f019e6a0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ca8ab547eb0bf4d01eef2e152"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1bfd21046ddcdb868c2695c4d2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a9cb95b01883d29d3194ccdab"`);
        await queryRunner.query(`DROP TABLE "archivos"`);
        await queryRunner.query(`DROP TABLE "traslados_elementos"`);
        await queryRunner.query(`DROP TABLE "audiencias_elementos"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eb4673cfe6fe2f95a48df5a15c"`);
        await queryRunner.query(`DROP TABLE "traslados"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_82abfae91aa418ab587be283ff"`);
        await queryRunner.query(`DROP TABLE "audiencias"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a31a1554bd056acd9f72901e4"`);
        await queryRunner.query(`DROP TABLE "movimientos"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c809a10fc0f22fe071c938b4b"`);
        await queryRunner.query(`DROP TABLE "ingreso_egreso"`);
        await queryRunner.query(`DROP TABLE "autoridad"`);
        await queryRunner.query(`DROP TABLE "tipo_incidencia"`);
        await queryRunner.query(`DROP TABLE "tipo_audiencia"`);
        await queryRunner.query(`DROP TABLE "destino_traslado"`);
        await queryRunner.query(`DROP TABLE "juez_juzgados"`);
        await queryRunner.query(`DROP TABLE "juzgados"`);
        await queryRunner.query(`DROP TABLE "centros"`);
        await queryRunner.query(`DROP TABLE "delitos"`);
        await queryRunner.query(`DROP TABLE "incidencias_elementos"`);
        await queryRunner.query(`DROP TABLE "incidencias_autoridades"`);
        await queryRunner.query(`DROP TABLE "incidencias_personas"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8de13987c63e0265ea17ed8644"`);
        await queryRunner.query(`DROP TABLE "incidencias"`);
        await queryRunner.query(`DROP TABLE "estatus_traslado"`);
        await queryRunner.query(`DROP TABLE "tipo_traslado"`);
        await queryRunner.query(`DROP TABLE "proxima_audiencia"`);
        await queryRunner.query(`DROP TABLE "modalidad_audiencia"`);
        await queryRunner.query(`DROP TABLE "resolucion_audiencia"`);
        await queryRunner.query(`DROP TABLE "forma_ingreso_audiencia"`);
        await queryRunner.query(`DROP TABLE "motivo_movimiento"`);
        await queryRunner.query(`DROP TABLE "tipo_movimientos"`);
        await queryRunner.query(`DROP TABLE "tipo_ingreso_egreso"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c494230f7e779287c8c2f2080c"`);
        await queryRunner.query(`DROP TABLE "elementos"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e7f154b3e55ba9be6eaf4f844a"`);
        await queryRunner.query(`DROP TABLE "domicilios"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_70473df0ca2bfcbbd867f2dc14"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_64455679da93be0ef9932d756d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9399e717cdfa10d27147e26553"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ca7f9046bd432ca387e05ddfe0"`);
        await queryRunner.query(`DROP TABLE "personas"`);
    }

}
