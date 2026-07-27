import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

/**
 * Generadores de documentos. CSV y Excel están implementados; PDF se deja como
 * stub (integra pdfkit/puppeteer según el proyecto). Todos operan sobre filas
 * genéricas obtenidas de la réplica de lectura.
 */
@Injectable()
export class Exporters {
  toCsv(rows: Record<string, unknown>[]): Buffer {
    if (rows.length === 0) return Buffer.from('');
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
    ];
    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  async toExcel(rows: Record<string, unknown>[], sheetName = 'Reporte'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    if (rows.length > 0) {
      sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
      sheet.addRows(rows);
    }
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  toPdf(_rows: Record<string, unknown>[]): Buffer {
    // TODO(proyecto): implementar con pdfkit o render HTML->PDF.
    throw new Error('PDF export no implementado en el andamiaje');
  }
}
