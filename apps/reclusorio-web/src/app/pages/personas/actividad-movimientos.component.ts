import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { Movimiento, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/** Movimientos internos/externos de la persona (RF-MOV-001..005). */
@Component({
  selector: 'rw-actividad-movimientos',
  standalone: true,
  imports: [DatePipe, FormsModule, PermisoDirective, ArchivosPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex justify-end">
        <button *rwPermiso="'movimientos:crear'" class="btn-primario btn-mini" type="button" (click)="mostrarForm.set(!mostrarForm())">
          {{ mostrarForm() ? 'Cancelar' : '+ Registrar movimiento' }}
        </button>
      </div>

      @if (mostrarForm()) {
        <form class="panel grid gap-4 p-4 md:grid-cols-3" (ngSubmit)="crear()">
          <div>
            <label class="campo-etiqueta obligatorio" for="movTipo">Tipo de movimiento</label>
            <select class="campo" id="movTipo" name="idTipoMovimiento" required [(ngModel)]="forma.idTipoMovimiento">
              <option value="" disabled>Selecciona…</option>
              @for (v of tipos(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="movMotivo">Motivo</label>
            <select class="campo" id="movMotivo" name="idMotivoMovimiento" required [(ngModel)]="forma.idMotivoMovimiento">
              <option value="" disabled>Selecciona…</option>
              @for (v of motivos(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="movFecha">Fecha y hora</label>
            <input class="campo" id="movFecha" name="fecha" type="datetime-local" required [(ngModel)]="forma.fecha" />
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="movOrigen">Centro de origen</label>
            <select class="campo" id="movOrigen" name="idCentroOrigen" required [(ngModel)]="forma.idCentroOrigen">
              <option value="" disabled>Selecciona…</option>
              @for (v of centros(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="movDestino">Centro de destino</label>
            <select class="campo" id="movDestino" name="idCentroDestino" required [(ngModel)]="forma.idCentroDestino">
              <option value="" disabled>Selecciona…</option>
              @for (v of centros(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta" for="movUbicacion">Ubicación</label>
            <input class="campo" id="movUbicacion" name="ubicacion" maxlength="255" [(ngModel)]="forma.ubicacion" />
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
        <p class="etiqueta animate-pulse">Cargando movimientos…</p>
      } @else if (registros().length === 0) {
        <p class="py-6 text-center text-sm text-slate-600">Sin movimientos registrados.</p>
      } @else {
        <table class="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Motivo</th>
              <th>Trayecto</th>
              <th>Ubicación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of registros(); track r.idMovimiento) {
              <tr>
                <td class="font-mono text-xs">{{ r.fecha | date: 'dd/MM/yy HH:mm' }}</td>
                <td><span class="chip-neon">{{ nombre(mapaTipos, r.idTipoMovimiento) }}</span></td>
                <td>{{ nombre(mapaMotivos, r.idMotivoMovimiento) }}</td>
                <td class="text-xs">
                  {{ nombre(mapaCentros, r.idCentroOrigen) }}
                  <span class="text-neon">→</span>
                  {{ nombre(mapaCentros, r.idCentroDestino) }}
                </td>
                <td>{{ r.ubicacion || '—' }}</td>
                <td class="text-right">
                  <button class="btn-secundario btn-mini" type="button" (click)="alternarExpandido(r.idMovimiento)">
                    {{ expandido() === r.idMovimiento ? 'Ocultar' : 'Archivos' }}
                  </button>
                </td>
              </tr>
              @if (expandido() === r.idMovimiento) {
                <tr>
                  <td colspan="6" class="bg-panel-2/40 px-4 py-4">
                    <rw-archivos-panel referencia="idMovimiento" [id]="r.idMovimiento" />
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
export class ActividadMovimientosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<Movimiento[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly expandido = signal<string | null>(null);

  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly motivos = signal<ValorCatalogo[]>([]);
  readonly centros = signal<ValorCatalogo[]>([]);
  mapaTipos = new Map<string, string>();
  mapaMotivos = new Map<string, string>();
  mapaCentros = new Map<string, string>();

  forma: Record<string, string> = { idTipoMovimiento: '', idMotivoMovimiento: '', fecha: '', idCentroOrigen: '', idCentroDestino: '', ubicacion: '' };

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargar();
  }

  nombre(mapa: Map<string, string>, id: string): string {
    return mapa.get(id) ?? '…';
  }

  alternarExpandido(id: string): void {
    this.expandido.set(this.expandido() === id ? null : id);
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      await this.api.post(`/api/v1/personas/${this.idPersona()}/movimientos`, {
        ...this.forma,
        fecha: new Date(this.forma['fecha']).toISOString(),
      });
      this.toast.ok('Movimiento registrado.');
      this.mostrarForm.set(false);
      this.forma = { idTipoMovimiento: '', idMotivoMovimiento: '', fecha: '', idCentroOrigen: '', idCentroDestino: '', ubicacion: '' };
      await this.cargar();
    } catch (err) {
      this.errorForm.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [tipos, motivos, centros] = await Promise.all([
        this.catalogos.valores('tipo_movimientos'),
        this.catalogos.valores('motivo_movimiento'),
        this.catalogos.valores('centros'),
      ]);
      this.tipos.set(tipos);
      this.motivos.set(motivos);
      this.centros.set(centros);
      this.mapaTipos = new Map(tipos.map((v) => [v.id, v.nombre]));
      this.mapaMotivos = new Map(motivos.map((v) => [v.id, v.nombre]));
      this.mapaCentros = new Map(centros.map((v) => [v.id, v.nombre]));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.registros.set(
        await this.api.get<Movimiento[]>(`/api/v1/personas/${this.idPersona()}/movimientos`),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
