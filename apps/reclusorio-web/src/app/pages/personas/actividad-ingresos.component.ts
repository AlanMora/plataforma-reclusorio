import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { IngresoEgreso, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/** Ingresos y libertades de la persona (RF-IEG-001..005). */
@Component({
  selector: 'rw-actividad-ingresos',
  standalone: true,
  imports: [DatePipe, FormsModule, PermisoDirective, ArchivosPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex justify-end">
        <button *rwPermiso="'ingresos:crear'" class="btn-primario btn-mini" type="button" (click)="mostrarForm.set(!mostrarForm())">
          {{ mostrarForm() ? 'Cancelar' : '+ Registrar ingreso / libertad' }}
        </button>
      </div>

      @if (mostrarForm()) {
        <form class="panel grid gap-4 p-4 md:grid-cols-3" (ngSubmit)="crear()">
          <div>
            <label class="campo-etiqueta obligatorio" for="ieTipo">Tipo</label>
            <select class="campo" id="ieTipo" name="idTipoIngresoEgreso" required [(ngModel)]="forma.idTipoIngresoEgreso">
              <option value="" disabled>Selecciona…</option>
              @for (v of tipos(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="ieFecha">Fecha y hora</label>
            <input class="campo" id="ieFecha" name="fecha" type="datetime-local" required [(ngModel)]="forma.fecha" />
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="ieCentro">Centro penitenciario</label>
            <select class="campo" id="ieCentro" name="idCentroPenitenciario" required [(ngModel)]="forma.idCentroPenitenciario">
              <option value="" disabled>Selecciona…</option>
              @for (v of centros(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta" for="ieDelito">Delito</label>
            <select class="campo" id="ieDelito" name="idDelito" [(ngModel)]="forma.idDelito">
              <option value="">— Sin especificar —</option>
              @for (v of delitos(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta" for="ieUbicacion">Ubicación</label>
            <input class="campo" id="ieUbicacion" name="ubicacion" maxlength="255" [(ngModel)]="forma.ubicacion" />
          </div>
          <div>
            <label class="campo-etiqueta" for="ieAutoridad">Autoridad que pone a disposición</label>
            <input class="campo" id="ieAutoridad" name="autoridad" maxlength="255" [(ngModel)]="forma.autoridad" />
          </div>
          @if (errorForm()) {
            <p class="alerta-error md:col-span-3">{{ errorForm() }}</p>
          }
          <div class="flex justify-end md:col-span-3">
            <button class="btn-primario" type="submit" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Registrar' }}
            </button>
          </div>
        </form>
      }

      @if (error()) {
        <p class="alerta-error">{{ error() }}</p>
      } @else if (cargando()) {
        <p class="etiqueta animate-pulse">Cargando historial…</p>
      } @else if (registros().length === 0) {
        <p class="py-6 text-center text-sm text-slate-600">Sin ingresos ni libertades registrados.</p>
      } @else {
        <table class="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Centro</th>
              <th>Delito</th>
              <th>Ubicación</th>
              <th>Autoridad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of registros(); track r.idIngresoEgreso) {
              <tr>
                <td class="font-mono text-xs">{{ r.fecha | date: 'dd/MM/yy HH:mm' }}</td>
                <td><span class="chip-neon">{{ nombreTipo(r.idTipoIngresoEgreso) }}</span></td>
                <td>{{ nombreCentro(r.idCentroPenitenciario) }}</td>
                <td class="max-w-[200px] truncate" [title]="nombreDelito(r.idDelito)">{{ nombreDelito(r.idDelito) }}</td>
                <td>{{ r.ubicacion || '—' }}</td>
                <td>{{ r.autoridad || '—' }}</td>
                <td class="text-right">
                  <button class="btn-secundario btn-mini" type="button" (click)="alternarExpandido(r.idIngresoEgreso)">
                    {{ expandido() === r.idIngresoEgreso ? 'Ocultar' : 'Archivos' }}
                  </button>
                </td>
              </tr>
              @if (expandido() === r.idIngresoEgreso) {
                <tr>
                  <td colspan="7" class="bg-panel-2/40 px-4 py-4">
                    <rw-archivos-panel referencia="idIngresoEgreso" [id]="r.idIngresoEgreso" />
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class ActividadIngresosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<IngresoEgreso[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly expandido = signal<string | null>(null);

  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly centros = signal<ValorCatalogo[]>([]);
  readonly delitos = signal<ValorCatalogo[]>([]);
  private mapaTipos = new Map<string, string>();
  private mapaCentros = new Map<string, string>();
  private mapaDelitos = new Map<string, string>();

  forma: Record<string, string> = { idTipoIngresoEgreso: '', fecha: '', idCentroPenitenciario: '', idDelito: '', ubicacion: '', autoridad: '' };

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargar();
  }

  alternarExpandido(id: string): void {
    this.expandido.set(this.expandido() === id ? null : id);
  }

  nombreTipo(id: string): string {
    return this.mapaTipos.get(id) ?? '…';
  }
  nombreCentro(id: string): string {
    return this.mapaCentros.get(id) ?? '…';
  }
  nombreDelito(id?: string): string {
    return id ? (this.mapaDelitos.get(id) ?? '…') : '—';
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      await this.api.post(`/api/v1/personas/${this.idPersona()}/ingresos-egresos`, {
        ...this.forma,
        fecha: new Date(this.forma['fecha']).toISOString(),
      });
      this.toast.ok('Ingreso/libertad registrado.');
      this.mostrarForm.set(false);
      this.forma = { idTipoIngresoEgreso: '', fecha: '', idCentroPenitenciario: '', idDelito: '', ubicacion: '', autoridad: '' };
      await this.cargar();
    } catch (err) {
      this.errorForm.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [tipos, centros, delitos] = await Promise.all([
        this.catalogos.valores('tipo_ingreso_egreso'),
        this.catalogos.valores('centros'),
        this.catalogos.valores('delitos'),
      ]);
      this.tipos.set(tipos);
      this.centros.set(centros);
      this.delitos.set(delitos);
      this.mapaTipos = new Map(tipos.map((v) => [v.id, v.nombre]));
      this.mapaCentros = new Map(centros.map((v) => [v.id, v.nombre]));
      this.mapaDelitos = new Map(delitos.map((v) => [v.id, v.nombre]));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.registros.set(
        await this.api.get<IngresoEgreso[]>(`/api/v1/personas/${this.idPersona()}/ingresos-egresos`),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
