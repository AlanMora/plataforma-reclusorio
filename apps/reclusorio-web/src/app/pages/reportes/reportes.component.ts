import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { mensajeDe } from '../../core/problem';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { OpcionSelect, SelectBuscableComponent } from '../../shared/select-buscable.component';

/** Fila del reporte consolidado (contrato de GET /reportes/actividades). */
interface FilaReporte {
  modulo: string;
  id: string;
  fecha: string;
  estadoRevision: string;
  persona: string | null;
  idPersona: string | null;
  detalle: Record<string, string | null>;
}

const ETIQUETAS_MODULO: Record<string, string> = {
  'ingresos-egresos': 'Ingresos / Libertades',
  movimientos: 'Movimientos',
  audiencias: 'Audiencias',
  traslados: 'Traslados',
  incidencias: 'Incidencias',
};

const MODULOS: OpcionSelect[] = Object.entries(ETIQUETAS_MODULO).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}));

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

function fechaLocal(fecha: Date): string {
  return (
    `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}` +
    `T${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`
  );
}

/**
 * Reporte de actividades: periodo [desde, hasta) con atajo "Hoy" (00:00 del
 * día en curso a 00:00 del siguiente), listado consolidado o segmentado por
 * módulo con el estado de validación (P10) y exportación CSV con todos los
 * detalles de los registros filtrados.
 */
@Component({
  selector: 'rw-reportes',
  standalone: true,
  imports: [DatePipe, FormsModule, SelectorFechaComponent, SelectBuscableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reportes.component.html',
})
export class ReportesComponent {
  private readonly api = inject(ApiService);

  readonly modulos = MODULOS;

  desde = '';
  hasta = '';
  modulo = '';

  readonly filas = signal<FilaReporte[]>([]);
  readonly consultado = signal(false);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly resumen = computed(() => {
    const conteo = { total: this.filas().length, PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0 };
    for (const f of this.filas()) {
      conteo[f.estadoRevision as 'PENDIENTE' | 'CONFIRMADO' | 'DESCARTADO'] =
        (conteo[f.estadoRevision as 'PENDIENTE'] ?? 0) + 1;
    }
    return conteo;
  });

  etiquetaModulo(modulo: string): string {
    return ETIQUETAS_MODULO[modulo] ?? modulo;
  }

  claseEstado(estado: string): string {
    if (estado === 'CONFIRMADO') return 'chip-ok';
    if (estado === 'DESCARTADO') return 'chip-peligro';
    return 'chip-alerta';
  }

  /** Pares clave→valor no vacíos del detalle, para pintarlos compactos. */
  detalleDe(fila: FilaReporte): Array<{ clave: string; valor: string }> {
    return Object.entries(fila.detalle)
      .filter(([, v]) => v !== null && v !== '')
      .map(([clave, valor]) => ({ clave, valor: String(valor) }));
  }

  /** Acceso rápido "Hoy": 00:00 del día en curso → 00:00 del día siguiente. */
  hoy(): void {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 1);
    this.desde = fechaLocal(inicio);
    this.hasta = fechaLocal(fin);
    void this.generar();
  }

  async generar(): Promise<void> {
    if (!this.desde || !this.hasta) {
      this.error.set('Seleccione el inicio y el fin del periodo (o use "Hoy").');
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.filas.set(
        await this.api.get<FilaReporte[]>('/api/v1/reportes/actividades', {
          desde: new Date(this.desde).toISOString(),
          hasta: new Date(this.hasta).toISOString(),
          modulo: this.modulo || undefined,
        }),
      );
      this.consultado.set(true);
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Exporta lo filtrado a CSV con TODOS los detalles y el estado (P10). */
  exportarCsv(): void {
    const filas = this.filas();
    const clavesDetalle = [...new Set(filas.flatMap((f) => Object.keys(f.detalle)))].sort();
    const encabezados = [
      'modulo',
      'id',
      'fecha',
      'persona',
      'idPersona',
      'estadoRevision',
      ...clavesDetalle,
    ];
    const lineas = [encabezados.join(',')];
    for (const f of filas) {
      const base = [
        this.etiquetaModulo(f.modulo),
        f.id,
        new Date(f.fecha).toISOString(),
        f.persona ?? '',
        f.idPersona ?? '',
        f.estadoRevision,
      ];
      const detalle = clavesDetalle.map((k) => f.detalle[k] ?? '');
      lineas.push([...base, ...detalle].map(escaparCsv).join(','));
    }
    // BOM para que Excel respete acentos.
    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `reporte-actividades_${this.desde.replace(/[:T]/g, '-')}_${this.hasta.replace(/[:T]/g, '-')}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }
}

function escaparCsv(valor: string): string {
  return /[",\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}
