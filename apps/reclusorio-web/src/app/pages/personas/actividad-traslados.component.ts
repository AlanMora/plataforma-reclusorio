import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { ElementoPickerComponent, nombreElemento } from '../../shared/elemento-picker.component';
import { Elemento, Traslado, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/** Traslados (RF-TRA-001..007) con elementos participantes (RF-TRA-006). */
@Component({
  selector: 'rw-actividad-traslados',
  standalone: true,
  imports: [DatePipe, FormsModule, PermisoDirective, ArchivosPanelComponent, ElementoPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex justify-end">
        <button *rwPermiso="'traslados:crear'" class="btn-primario btn-mini" type="button" (click)="mostrarForm.set(!mostrarForm())">
          {{ mostrarForm() ? 'Cancelar' : '+ Registrar traslado' }}
        </button>
      </div>

      @if (mostrarForm()) {
        <form class="panel grid gap-4 p-4 md:grid-cols-3" (ngSubmit)="crear()">
          <div>
            <label class="campo-etiqueta obligatorio" for="traFecha">Fecha y hora</label>
            <input class="campo" id="traFecha" name="fecha" type="datetime-local" required [(ngModel)]="forma.fecha" />
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="traTipo">Tipo de traslado</label>
            <select class="campo" id="traTipo" name="idTipoTraslado" required [(ngModel)]="forma.idTipoTraslado">
              <option value="" disabled>Selecciona…</option>
              @for (v of tipos(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="traDestino">Destino</label>
            <select class="campo" id="traDestino" name="idDestinoTraslado" required [(ngModel)]="forma.idDestinoTraslado">
              <option value="" disabled>Selecciona…</option>
              @for (v of destinos(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="traEstatus">Estatus</label>
            <select class="campo" id="traEstatus" name="idEstatusTraslado" required [(ngModel)]="forma.idEstatusTraslado">
              <option value="" disabled>Selecciona…</option>
              @for (v of estatus(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta" for="traUnidades">Unidades</label>
            <input class="campo" id="traUnidades" name="unidades" maxlength="255" [(ngModel)]="forma.unidades" />
          </div>
          <div class="md:col-span-3">
            <label class="campo-etiqueta" for="traDescripcion">Descripción</label>
            <textarea class="campo" id="traDescripcion" name="descripcion" rows="2" maxlength="2000" [(ngModel)]="forma.descripcion"></textarea>
          </div>
          <div class="md:col-span-3">
            <label class="campo-etiqueta" for="traObservaciones">Observaciones</label>
            <textarea class="campo" id="traObservaciones" name="observaciones" rows="2" maxlength="2000" [(ngModel)]="forma.observaciones"></textarea>
          </div>
          @if (errorForm()) {
            <p class="alerta-error md:col-span-3">{{ errorForm() }}</p>
          }
          <div class="flex justify-end md:col-span-3">
            <button class="btn-primario" type="submit" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Registrar traslado' }}
            </button>
          </div>
        </form>
      }

      @if (error()) {
        <p class="alerta-error">{{ error() }}</p>
      } @else if (cargando()) {
        <p class="etiqueta animate-pulse">Cargando traslados…</p>
      } @else if (registros().length === 0) {
        <p class="py-6 text-center text-sm text-slate-600">Sin traslados registrados.</p>
      } @else {
        <table class="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Destino</th>
              <th>Estatus</th>
              <th>Unidades</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of registros(); track r.idTraslado) {
              <tr>
                <td class="font-mono text-xs">{{ r.fecha | date: 'dd/MM/yy HH:mm' }}</td>
                <td><span class="chip-neon">{{ nombre(mapaTipos, r.idTipoTraslado) }}</span></td>
                <td class="max-w-[220px] truncate">{{ nombre(mapaDestinos, r.idDestinoTraslado) }}</td>
                <td>
                  <span class="chip-alerta">{{ nombre(mapaEstatus, r.idEstatusTraslado) }}</span>
                </td>
                <td>{{ r.unidades || '—' }}</td>
                <td class="text-right">
                  <button class="btn-secundario btn-mini" type="button" (click)="alternarExpandido(r.idTraslado)">
                    {{ expandido() === r.idTraslado ? 'Ocultar' : 'Detalle' }}
                  </button>
                </td>
              </tr>
              @if (expandido() === r.idTraslado) {
                <tr>
                  <td colspan="6" class="bg-panel-2/40 px-4 py-4">
                    <div class="space-y-5">
                      @if (r.descripcion || r.observaciones) {
                        <div class="text-sm text-slate-400">
                          @if (r.descripcion) {
                            <p><span class="etiqueta">Descripción:</span> {{ r.descripcion }}</p>
                          }
                          @if (r.observaciones) {
                            <p class="mt-1"><span class="etiqueta">Observaciones:</span> {{ r.observaciones }}</p>
                          }
                        </div>
                      }
                      <div>
                        <p class="etiqueta mb-2">Elementos participantes (RF-TRA-006)</p>
                        @if (elementosAsociados().length === 0) {
                          <p class="text-sm text-slate-600">Sin elementos asociados.</p>
                        }
                        <div class="flex flex-wrap gap-2">
                          @for (e of elementosAsociados(); track e.idElemento) {
                            <span class="chip-neon">{{ nombreDeElemento(e) }}</span>
                          }
                        </div>
                        <div *rwPermiso="'traslados:asociar'" class="mt-3">
                          <rw-elemento-picker (elegido)="asociarElemento(r.idTraslado, $event)" />
                        </div>
                      </div>
                      <div>
                        <p class="etiqueta mb-2">Expediente digital</p>
                        <rw-archivos-panel referencia="idTraslado" [id]="r.idTraslado" />
                      </div>
                    </div>
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
export class ActividadTrasladosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<Traslado[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly expandido = signal<string | null>(null);
  readonly elementosAsociados = signal<Elemento[]>([]);

  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly destinos = signal<ValorCatalogo[]>([]);
  readonly estatus = signal<ValorCatalogo[]>([]);
  mapaTipos = new Map<string, string>();
  mapaDestinos = new Map<string, string>();
  mapaEstatus = new Map<string, string>();

  nombreDeElemento = nombreElemento;

  forma: Record<string, string> = {
    fecha: '',
    idTipoTraslado: '',
    idDestinoTraslado: '',
    idEstatusTraslado: '',
    descripcion: '',
    unidades: '',
    observaciones: '',
  };

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargar();
  }

  nombre(mapa: Map<string, string>, id: string): string {
    return mapa.get(id) ?? '…';
  }

  alternarExpandido(id: string): void {
    const nuevo = this.expandido() === id ? null : id;
    this.expandido.set(nuevo);
    this.elementosAsociados.set([]);
    if (nuevo) void this.cargarElementos(nuevo);
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      await this.api.post(`/api/v1/personas/${this.idPersona()}/traslados`, {
        ...this.forma,
        fecha: new Date(this.forma['fecha']).toISOString(),
      });
      this.toast.ok('Traslado registrado.');
      this.mostrarForm.set(false);
      await this.cargar();
    } catch (err) {
      this.errorForm.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async asociarElemento(idTraslado: string, elemento: Elemento): Promise<void> {
    try {
      await this.api.post(`/api/v1/traslados/${idTraslado}/elementos`, {
        idElemento: elemento.idElemento,
      });
      this.toast.ok('Elemento asociado al traslado.');
      await this.cargarElementos(idTraslado);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  private async cargarElementos(idTraslado: string): Promise<void> {
    try {
      const detalle = await this.api.get<Traslado>(`/api/v1/traslados/${idTraslado}`);
      const elementos = await Promise.all(
        (detalle.elementos ?? []).map((id) => this.api.get<Elemento>(`/api/v1/elementos/${id}`)),
      );
      this.elementosAsociados.set(elementos);
    } catch {
      // sin permiso elementos:consultar solo se omiten los nombres
    }
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [tipos, destinos, estatus] = await Promise.all([
        this.catalogos.valores('tipo_traslado'),
        this.catalogos.valores('destino_traslado'),
        this.catalogos.valores('estatus_traslado'),
      ]);
      this.tipos.set(tipos);
      this.destinos.set(destinos);
      this.estatus.set(estatus);
      this.mapaTipos = new Map(tipos.map((v) => [v.id, v.nombre]));
      this.mapaDestinos = new Map(destinos.map((v) => [v.id, v.nombre]));
      this.mapaEstatus = new Map(estatus.map((v) => [v.id, v.nombre]));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.registros.set(await this.api.get<Traslado[]>(`/api/v1/personas/${this.idPersona()}/traslados`));
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
