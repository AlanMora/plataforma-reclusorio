import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { ElementoPickerComponent, nombreElemento } from '../../shared/elemento-picker.component';
import { Audiencia, Elemento, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/**
 * Audiencias (RF-AUD-001..008): datos jurídicos, clasificación, coherencia
 * de próxima audiencia (si es NO la fecha siguiente queda deshabilitada)
 * y asociación de elementos participantes sin duplicar (RF-AUD-006).
 */
@Component({
  selector: 'rw-actividad-audiencias',
  standalone: true,
  imports: [DatePipe, FormsModule, PermisoDirective, ArchivosPanelComponent, ElementoPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex justify-end">
        <button *rwPermiso="'audiencias:crear'" class="btn-primario btn-mini" type="button" (click)="mostrarForm.set(!mostrarForm())">
          {{ mostrarForm() ? 'Cancelar' : '+ Registrar audiencia' }}
        </button>
      </div>

      @if (mostrarForm()) {
        <form class="panel grid gap-4 p-4 md:grid-cols-3" (ngSubmit)="crear()">
          <div>
            <label class="campo-etiqueta obligatorio" for="audFecha">Fecha y hora</label>
            <input class="campo" id="audFecha" name="fecha" type="datetime-local" required [(ngModel)]="forma.fecha" />
          </div>
          <div>
            <label class="campo-etiqueta" for="audCa">Carpeta administrativa (CA)</label>
            <input class="campo" id="audCa" name="ca" maxlength="100" [(ngModel)]="forma.ca" />
          </div>
          <div>
            <label class="campo-etiqueta" for="audCi">Carpeta de investigación (CI)</label>
            <input class="campo" id="audCi" name="ci" maxlength="100" [(ngModel)]="forma.ci" />
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="audForma">Forma de ingreso</label>
            <select class="campo" id="audForma" name="idFormaIngresoAudiencia" required [(ngModel)]="forma.idFormaIngresoAudiencia">
              <option value="" disabled>Selecciona…</option>
              @for (v of formasIngreso(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="audJuzgado">Juzgado</label>
            <select class="campo" id="audJuzgado" name="idJuzgado" required [(ngModel)]="forma.idJuzgado">
              <option value="" disabled>Selecciona…</option>
              @for (v of juzgados(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="audJuez">Juez del juzgado</label>
            <select class="campo" id="audJuez" name="idJuezJuzgado" required [(ngModel)]="forma.idJuezJuzgado">
              <option value="" disabled>Selecciona…</option>
              @for (v of jueces(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta" for="audNombreJuez">Nombre del juez (texto)</label>
            <input class="campo" id="audNombreJuez" name="nombreJuez" maxlength="255" [(ngModel)]="forma.nombreJuez" />
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="audTipo">Tipo de audiencia</label>
            <select class="campo" id="audTipo" name="idTipoAudiencia" required [(ngModel)]="forma.idTipoAudiencia">
              <option value="" disabled>Selecciona…</option>
              @for (v of tipos(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="audModalidad">Modalidad</label>
            <select class="campo" id="audModalidad" name="idModalidadAudiencia" required [(ngModel)]="forma.idModalidadAudiencia">
              <option value="" disabled>Selecciona…</option>
              @for (v of modalidades(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta" for="audResolucion">Resolución</label>
            <select class="campo" id="audResolucion" name="idResolucionAudiencia" [(ngModel)]="forma.idResolucionAudiencia">
              <option value="">— Sin resolución —</option>
              @for (v of resoluciones(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="audProxima">¿Habrá próxima audiencia?</label>
            <select class="campo" id="audProxima" name="idProximaAudiencia" required [(ngModel)]="forma.idProximaAudiencia" (ngModelChange)="alCambiarProxima()">
              <option value="" disabled>Selecciona…</option>
              @for (v of proximas(); track v.id) {
                <option [value]="v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="campo-etiqueta" for="audSiguiente">Fecha de la siguiente audiencia</label>
            <input
              class="campo"
              id="audSiguiente"
              name="fechaSiguienteAudiencia"
              type="datetime-local"
              [disabled]="proximaEsNo()"
              [(ngModel)]="forma.fechaSiguienteAudiencia"
            />
            @if (proximaEsNo()) {
              <p class="mt-1 text-[11px] text-slate-600">Debe permanecer vacía cuando la próxima audiencia es NO (RF-AUD-004).</p>
            }
          </div>
          <div class="md:col-span-3">
            <label class="campo-etiqueta" for="audObservaciones">Observaciones</label>
            <textarea class="campo" id="audObservaciones" name="observaciones" rows="2" maxlength="2000" [(ngModel)]="forma.observaciones"></textarea>
          </div>
          @if (errorForm()) {
            <p class="alerta-error md:col-span-3">{{ errorForm() }}</p>
          }
          <div class="flex justify-end md:col-span-3">
            <button class="btn-primario" type="submit" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Registrar audiencia' }}
            </button>
          </div>
        </form>
      }

      @if (error()) {
        <p class="alerta-error">{{ error() }}</p>
      } @else if (cargando()) {
        <p class="etiqueta animate-pulse">Cargando audiencias…</p>
      } @else if (registros().length === 0) {
        <p class="py-6 text-center text-sm text-slate-600">Sin audiencias registradas.</p>
      } @else {
        <table class="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Juzgado</th>
              <th>Modalidad</th>
              <th>Resolución</th>
              <th>Próxima</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of registros(); track r.idAudiencia) {
              <tr>
                <td class="font-mono text-xs">{{ r.fecha | date: 'dd/MM/yy HH:mm' }}</td>
                <td><span class="chip-neon">{{ nombre(mapaTipos, r.idTipoAudiencia) }}</span></td>
                <td class="max-w-[180px] truncate">{{ nombre(mapaJuzgados, r.idJuzgado) }}</td>
                <td>{{ nombre(mapaModalidades, r.idModalidadAudiencia) }}</td>
                <td>{{ r.idResolucionAudiencia ? nombre(mapaResoluciones, r.idResolucionAudiencia) : '—' }}</td>
                <td class="font-mono text-xs">
                  {{ nombre(mapaProximas, r.idProximaAudiencia) }}
                  @if (r.fechaSiguienteAudiencia) {
                    · {{ r.fechaSiguienteAudiencia | date: 'dd/MM/yy HH:mm' }}
                  }
                </td>
                <td class="text-right">
                  <button class="btn-secundario btn-mini" type="button" (click)="alternarExpandido(r.idAudiencia)">
                    {{ expandido() === r.idAudiencia ? 'Ocultar' : 'Detalle' }}
                  </button>
                </td>
              </tr>
              @if (expandido() === r.idAudiencia) {
                <tr>
                  <td colspan="7" class="bg-panel-2/40 px-4 py-4">
                    <div class="space-y-5">
                      <div>
                        <p class="etiqueta mb-2">Elementos participantes (RF-AUD-006)</p>
                        @if (elementosAsociados().length === 0) {
                          <p class="text-sm text-slate-600">Sin elementos asociados.</p>
                        }
                        <div class="flex flex-wrap gap-2">
                          @for (e of elementosAsociados(); track e.idElemento) {
                            <span class="chip-neon">{{ nombreDeElemento(e) }}</span>
                          }
                        </div>
                        <div *rwPermiso="'audiencias:asociar'" class="mt-3">
                          <rw-elemento-picker (elegido)="asociarElemento(r.idAudiencia, $event)" />
                        </div>
                      </div>
                      <div>
                        <p class="etiqueta mb-2">Expediente digital</p>
                        <rw-archivos-panel referencia="idAudiencia" [id]="r.idAudiencia" />
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
export class ActividadAudienciasComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<Audiencia[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly expandido = signal<string | null>(null);
  readonly elementosAsociados = signal<Elemento[]>([]);
  readonly proximaEsNo = signal(false);

  readonly formasIngreso = signal<ValorCatalogo[]>([]);
  readonly juzgados = signal<ValorCatalogo[]>([]);
  readonly jueces = signal<ValorCatalogo[]>([]);
  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly modalidades = signal<ValorCatalogo[]>([]);
  readonly resoluciones = signal<ValorCatalogo[]>([]);
  readonly proximas = signal<ValorCatalogo[]>([]);
  mapaTipos = new Map<string, string>();
  mapaJuzgados = new Map<string, string>();
  mapaModalidades = new Map<string, string>();
  mapaResoluciones = new Map<string, string>();
  mapaProximas = new Map<string, string>();

  nombreDeElemento = nombreElemento;

  forma: Record<string, string> = {
    fecha: '',
    ca: '',
    ci: '',
    idFormaIngresoAudiencia: '',
    idJuzgado: '',
    idJuezJuzgado: '',
    nombreJuez: '',
    idTipoAudiencia: '',
    idModalidadAudiencia: '',
    idResolucionAudiencia: '',
    observaciones: '',
    idProximaAudiencia: '',
    fechaSiguienteAudiencia: '',
  };

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargar();
  }

  nombre(mapa: Map<string, string>, id: string): string {
    return mapa.get(id) ?? '…';
  }

  /** RF-AUD-004: si la próxima audiencia es NO, la fecha siguiente se limpia. */
  alCambiarProxima(): void {
    const elegido = this.proximas().find((v) => v.id === this.forma['idProximaAudiencia']);
    const esNo = elegido?.nombre?.trim().toUpperCase() === 'NO';
    this.proximaEsNo.set(esNo);
    if (esNo) this.forma['fechaSiguienteAudiencia'] = '';
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
      await this.api.post(`/api/v1/personas/${this.idPersona()}/audiencias`, {
        ...this.forma,
        fecha: new Date(this.forma['fecha']).toISOString(),
        fechaSiguienteAudiencia: this.forma['fechaSiguienteAudiencia']
          ? new Date(this.forma['fechaSiguienteAudiencia']).toISOString()
          : '',
      });
      this.toast.ok('Audiencia registrada.');
      this.mostrarForm.set(false);
      await this.cargar();
    } catch (err) {
      this.errorForm.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async asociarElemento(idAudiencia: string, elemento: Elemento): Promise<void> {
    try {
      await this.api.post(`/api/v1/audiencias/${idAudiencia}/elementos`, {
        idElemento: elemento.idElemento,
      });
      this.toast.ok('Elemento asociado a la audiencia.');
      await this.cargarElementos(idAudiencia);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  private async cargarElementos(idAudiencia: string): Promise<void> {
    try {
      const detalle = await this.api.get<Audiencia>(`/api/v1/audiencias/${idAudiencia}`);
      const elementos = await Promise.all(
        (detalle.elementos ?? []).map((id) => this.api.get<Elemento>(`/api/v1/elementos/${id}`)),
      );
      this.elementosAsociados.set(elementos);
    } catch {
      // el permiso elementos:consultar puede faltar; se muestran solo chips vacíos
    }
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [formas, juzgados, jueces, tipos, modalidades, resoluciones, proximas] = await Promise.all([
        this.catalogos.valores('forma_ingreso_audiencia'),
        this.catalogos.valores('juzgados'),
        this.catalogos.valores('juez_juzgados'),
        this.catalogos.valores('tipo_audiencia'),
        this.catalogos.valores('modalidad_audiencia'),
        this.catalogos.valores('resolucion_audiencia'),
        this.catalogos.valores('proxima_audiencia'),
      ]);
      this.formasIngreso.set(formas);
      this.juzgados.set(juzgados);
      this.jueces.set(jueces);
      this.tipos.set(tipos);
      this.modalidades.set(modalidades);
      this.resoluciones.set(resoluciones);
      this.proximas.set(proximas);
      this.mapaTipos = new Map(tipos.map((v) => [v.id, v.nombre]));
      this.mapaJuzgados = new Map(juzgados.map((v) => [v.id, v.nombre]));
      this.mapaModalidades = new Map(modalidades.map((v) => [v.id, v.nombre]));
      this.mapaResoluciones = new Map(resoluciones.map((v) => [v.id, v.nombre]));
      this.mapaProximas = new Map(proximas.map((v) => [v.id, v.nombre]));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.registros.set(await this.api.get<Audiencia[]>(`/api/v1/personas/${this.idPersona()}/audiencias`));
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
