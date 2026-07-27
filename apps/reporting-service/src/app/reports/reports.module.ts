import { Controller, Get, Injectable, Module, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Response } from 'express';
import { ApiResponse } from '@icms/common';
import { Exporters, ExportFormat } from './exporters';

/**
 * Genera reportes ejecutando consultas de sólo lectura. Al usar la réplica
 * (slave) evitamos cargar al primary de escritura.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly exporters: Exporters,
  ) {}

  /** Ejecuta una consulta forzando la réplica de lectura. */
  async runReadQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const runner = this.dataSource.createQueryRunner('slave');
    try {
      return (await runner.query(sql, params)) as T[];
    } finally {
      await runner.release();
    }
  }

  async export(rows: Record<string, unknown>[], format: ExportFormat) {
    switch (format) {
      case 'csv':
        return { buffer: this.exporters.toCsv(rows), contentType: 'text/csv', ext: 'csv' };
      case 'excel':
        return {
          buffer: await this.exporters.toExcel(rows),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ext: 'xlsx',
        };
      case 'pdf':
        return { buffer: this.exporters.toPdf(rows), contentType: 'application/pdf', ext: 'pdf' };
    }
  }
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('sample')
  @ApiOperation({ summary: 'Reporte de ejemplo (usa réplica de lectura)' })
  async sample() {
    // Ejemplo neutro que no depende del esquema del proyecto.
    const rows = await this.service.runReadQuery<{ now: string }>('SELECT NOW()::text AS now');
    return ApiResponse.ok(rows);
  }

  @Get('sample/export')
  @ApiQuery({ name: 'format', enum: ['csv', 'excel', 'pdf'] })
  @ApiOperation({ summary: 'Exportar reporte de ejemplo' })
  async exportSample(@Query('format') format: ExportFormat = 'csv', @Res() res: Response) {
    const rows = await this.service.runReadQuery('SELECT NOW()::text AS now');
    const { buffer, contentType, ext } = await this.service.export(rows, format);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="reporte.${ext}"`);
    res.send(buffer);
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, Exporters],
})
export class ReportsModule {}
