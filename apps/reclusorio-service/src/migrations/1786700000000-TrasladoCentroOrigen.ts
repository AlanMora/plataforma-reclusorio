import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Centro de origen explícito en los traslados (decisión del equipo 2026-09-18).
 * Hasta ahora el origen se INFERÍA del último INGRESO de la persona, solo para
 * pintar el mapa; ahora se captura y se guarda con el traslado.
 *
 * La columna es NOT NULL, así que el relleno va en tres pasos dentro de la
 * misma transacción: se agrega opcional, se rellena con el centro del último
 * ingreso/egreso no descartado de cada persona y, si quedara algún traslado
 * sin origen, la migración ABORTA con el detalle en vez de dejar la tabla a
 * medias o inventar un centro.
 */
export class TrasladoCentroOrigen1786700000000 implements MigrationInterface {
  name = 'TrasladoCentroOrigen1786700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "traslados" ADD "idCentroOrigen" uuid');

    await queryRunner.query(`
      UPDATE "traslados" t
         SET "idCentroOrigen" = u."idCentroPenitenciario"
        FROM (
          SELECT DISTINCT ON (ie."idPersona")
                 ie."idPersona", ie."idCentroPenitenciario"
            FROM ingreso_egreso ie
           WHERE ie."estadoRevision" <> 'DESCARTADO'
           ORDER BY ie."idPersona", ie.fecha DESC, ie."idIngresoEgreso" DESC
        ) u
       WHERE u."idPersona" = t."idPersona"
         AND u."idCentroPenitenciario" IS NOT NULL
    `);

    const [{ pendientes }]: Array<{ pendientes: string }> = await queryRunner.query(
      'SELECT COUNT(*)::text AS pendientes FROM "traslados" WHERE "idCentroOrigen" IS NULL',
    );
    if (Number(pendientes) > 0) {
      throw new Error(
        `No se puede aplicar TrasladoCentroOrigen: ${pendientes} traslado(s) pertenecen a personas ` +
          'sin ingreso/egreso registrado, así que no hay centro de origen del cual partir. ' +
          'Captura el ingreso de esas personas o asigna el centro a mano antes de volver a correr ' +
          'la migración (SELECT "idTraslado", "idPersona" FROM traslados WHERE "idCentroOrigen" IS NULL).',
      );
    }

    await queryRunner.query('ALTER TABLE "traslados" ALTER COLUMN "idCentroOrigen" SET NOT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "traslados" DROP COLUMN "idCentroOrigen"');
  }
}
