import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { PaginadorComponent } from '../../shared/paginador.component';
import { Elemento, Paginado } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { nombreElemento } from '../../shared/elemento-picker.component';

/**
 * Padrón de elementos (RF-ELE-001..005 / RF-GEN-007): la BÚSQUEDA PREVIA es
 * obligatoria; el alta solo se habilita tras buscar y confirmar que ninguna
 * coincidencia corresponde (alta condicionada, RF-ELE-002).
 */
@Component({
  selector: 'rw-elementos',
  standalone: true,
  imports: [FormsModule, PermisoDirective, PaginadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-6xl space-y-5">
      <div>
        <p class="etiqueta">Módulo</p>
        <h2 class="text-2xl font-bold text-slate-100">Padrón de elementos</h2>
      </div>

      <!-- Búsqueda previa -->
      <div class="panel space-y-4 p-4">
        <p class="etiqueta">Búsqueda previa (obligatoria antes del alta)</p>
        <form class="flex flex-wrap items-end gap-3" (ngSubmit)="buscarCoincidencias()">
          <div>
            <label class="campo-etiqueta" for="numBusqueda">No. de elemento</label>
            <input class="campo" id="numBusqueda" name="numeroElemento" maxlength="50" [(ngModel)]="criterios.numeroElemento" />
          </div>
          <div class="grow">
            <label class="campo-etiqueta" for="nombreBusqueda">Nombre completo</label>
            <input class="campo" id="nombreBusqueda" name="nombre" maxlength="200" [(ngModel)]="criterios.nombre" />
          </div>
          <div class="grow">
            <label class="campo-etiqueta" for="adsBusqueda">Adscripción</label>
            <input class="campo" id="adsBusqueda" name="adscripcion" maxlength="255" [(ngModel)]="criterios.adscripcion" />
          </div>
          <button class="btn-primario" type="submit" [disabled]="buscando()">
            {{ buscando() ? 'Buscando…' : 'Buscar coincidencias' }}
          </button>
        </form>

        @if (errorBusqueda()) {
          <p class="alerta-error">{{ errorBusqueda() }}</p>
        }
        @if (busquedaHecha()) {
          @if (coincidencias().length > 0) {
            <p class="alerta-info">
              {{ coincidencias().length }} coincidencia(s). Verifica antes de crear un registro nuevo (RF-ELE-002).
            </p>
            <table class="tabla">
              <thead>
                <tr><th>Elemento</th><th>Número</th><th>Adscripción</th><th></th></tr>
              </thead>
              <tbody>
                @for (e of coincidencias(); track e.idElemento) {
                  <tr>
                    <td class="text-slate-100">{{ nombreDe(e) }}</td>
                    <td class="font-mono text-xs">{{ e.numeroElemento || 's/n' }}</td>
                    <td>{{ e.adscripcion || '—' }}</td>
                    <td class="text-right">
                      <button *rwPermiso="'elementos:modificar'" class="btn-secundario btn-mini" type="button" (click)="editar(e)">
                        Editar
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="text-sm text-slate-400">Sin coincidencias en el padrón.</p>
          }
          <div *rwPermiso="'elementos:crear'">
            <button class="btn-primario btn-mini" type="button" (click)="mostrarAlta.set(true)">
              Ninguna coincidencia corresponde — registrar elemento nuevo
            </button>
          </div>
        }
      </div>

      <!-- Alta condicionada / edición -->
      @if (mostrarAlta() || elementoEnEdicion()) {
        <form class="panel grid gap-4 p-4 md:grid-cols-3" (ngSubmit)="guardar()">
          <p class="etiqueta md:col-span-3">
            {{ elementoEnEdicion() ? 'Modificar elemento' : 'Alta de elemento (tras búsqueda previa)' }}
          </p>
          <div>
            <label class="campo-etiqueta" for="grado">Grado</label>
            <input class="campo" id="grado" name="grado" maxlength="50" [(ngModel)]="forma.grado" />
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="primerNombreElem">Nombre(s)</label>
            <input class="campo" id="primerNombreElem" name="primerNombre" maxlength="100" required [(ngModel)]="forma.primerNombre" />
          </div>
          <div>
            <label class="campo-etiqueta obligatorio" for="apellidoPaternoElem">Apellido paterno</label>
            <input class="campo" id="apellidoPaternoElem" name="apellidoPaterno" maxlength="100" required [(ngModel)]="forma.apellidoPaterno" />
          </div>
          <div>
            <label class="campo-etiqueta" for="apellidoMaternoElem">Apellido materno</label>
            <input class="campo" id="apellidoMaternoElem" name="apellidoMaterno" maxlength="100" [(ngModel)]="forma.apellidoMaterno" />
          </div>
          <div>
            <label class="campo-etiqueta" for="numeroElemento">No. de elemento</label>
            <input class="campo font-mono" id="numeroElemento" name="numeroElemento" maxlength="50" placeholder="Admite letras y ceros" [(ngModel)]="forma.numeroElemento" />
          </div>
          <div>
            <label class="campo-etiqueta" for="adscripcion">Adscripción</label>
            <input class="campo" id="adscripcion" name="adscripcion" maxlength="255" [(ngModel)]="forma.adscripcion" />
          </div>
          @if (errorForm()) {
            <p class="alerta-error md:col-span-3">{{ errorForm() }}</p>
          }
          <div class="flex justify-end gap-2 md:col-span-3">
            <button class="btn-secundario" type="button" (click)="cancelarForm()">Cancelar</button>
            <button class="btn-primario" type="submit" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : elementoEnEdicion() ? 'Guardar cambios' : 'Registrar elemento' }}
            </button>
          </div>
        </form>
      }

      <!-- Padrón completo -->
      <div class="panel overflow-x-auto p-2">
        <table class="tabla">
          <thead>
            <tr><th>Grado</th><th>Elemento</th><th>Número</th><th>Adscripción</th><th></th></tr>
          </thead>
          <tbody>
            @if (pagina().items.length === 0) {
              <tr><td colspan="5" class="py-8 text-center text-slate-500">Padrón vacío.</td></tr>
            }
            @for (e of pagina().items; track e.idElemento) {
              <tr>
                <td>{{ e.grado || '—' }}</td>
                <td class="text-slate-100">
                  {{ [e.primerNombre, e.apellidoPaterno, e.apellidoMaterno].join(' ') }}
                </td>
                <td class="font-mono text-xs">{{ e.numeroElemento || 's/n' }}</td>
                <td>{{ e.adscripcion || '—' }}</td>
                <td class="text-right">
                  <button *rwPermiso="'elementos:modificar'" class="btn-secundario btn-mini" type="button" (click)="editar(e)">
                    Editar
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <rw-paginador
          [page]="pagina().page"
          [totalPages]="pagina().totalPages"
          [total]="pagina().total"
          (cambiar)="cargarPadron($event)"
        />
      </div>
    </div>
  `,
})
export class ElementosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly pagina = signal<Paginado<Elemento>>({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  readonly coincidencias = signal<Elemento[]>([]);
  readonly busquedaHecha = signal(false);
  readonly buscando = signal(false);
  readonly guardando = signal(false);
  readonly mostrarAlta = signal(false);
  readonly elementoEnEdicion = signal<Elemento | null>(null);
  readonly errorBusqueda = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);

  criterios: Record<string, string> = { numeroElemento: '', nombre: '', adscripcion: '' };
  forma: Record<string, string> = { grado: '', primerNombre: '', apellidoPaterno: '', apellidoMaterno: '', numeroElemento: '', adscripcion: '' };

  nombreDe = nombreElemento;

  ngOnInit(): void {
    void this.cargarPadron(1);
  }

  async buscarCoincidencias(): Promise<void> {
    this.buscando.set(true);
    this.errorBusqueda.set(null);
    try {
      this.coincidencias.set(
        await this.api.get<Elemento[]>('/api/v1/elementos/coincidencias', {
          numeroElemento: this.criterios['numeroElemento'].trim() || undefined,
          nombre: this.criterios['nombre'].trim() || undefined,
          adscripcion: this.criterios['adscripcion'].trim() || undefined,
        }),
      );
      this.busquedaHecha.set(true);
      this.mostrarAlta.set(false);
    } catch (err) {
      this.errorBusqueda.set(mensajeDe(err));
    } finally {
      this.buscando.set(false);
    }
  }

  editar(e: Elemento): void {
    this.elementoEnEdicion.set(e);
    this.mostrarAlta.set(false);
    this.forma = {
      grado: e.grado ?? '',
      primerNombre: e.primerNombre ?? '',
      apellidoPaterno: e.apellidoPaterno ?? '',
      apellidoMaterno: e.apellidoMaterno ?? '',
      numeroElemento: e.numeroElemento ?? '',
      adscripcion: e.adscripcion ?? '',
    };
  }

  cancelarForm(): void {
    this.mostrarAlta.set(false);
    this.elementoEnEdicion.set(null);
    this.errorForm.set(null);
    this.forma = { grado: '', primerNombre: '', apellidoPaterno: '', apellidoMaterno: '', numeroElemento: '', adscripcion: '' };
  }

  async guardar(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      const enEdicion = this.elementoEnEdicion();
      if (enEdicion) {
        await this.api.patch(`/api/v1/elementos/${enEdicion.idElemento}`, this.forma);
        this.toast.ok('Elemento actualizado.');
      } else {
        await this.api.post('/api/v1/elementos', this.forma);
        this.toast.ok('Elemento registrado en el padrón.');
      }
      this.cancelarForm();
      this.busquedaHecha.set(false);
      this.coincidencias.set([]);
      await this.cargarPadron(1);
    } catch (err) {
      this.errorForm.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async cargarPadron(page: number): Promise<void> {
    try {
      this.pagina.set(await this.api.get<Paginado<Elemento>>('/api/v1/elementos', { page, limit: 20 }));
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }
}
