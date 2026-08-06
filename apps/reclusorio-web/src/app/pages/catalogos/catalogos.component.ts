import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CATALOGOS_ADMINISTRABLES,
  CATALOGOS_FIJOS,
  CatalogosService,
} from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/**
 * Administración de catálogos (RF-CAT-001..010): alta, corrección,
 * desactivar/reactivar (jamás borrar). Los fijos son SOLO lectura.
 * El dedup normalizado (espacios/mayúsculas/acentos) lo aplica el backend.
 */
@Component({
  selector: 'rw-catalogos',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-6xl space-y-5">
      <div>
        <p class="etiqueta">Módulo</p>
        <h2 class="text-2xl font-bold text-slate-100">Catálogos</h2>
      </div>

      <div class="grid gap-5 lg:grid-cols-[260px_1fr]">
        <!-- Selector -->
        <div class="space-y-4">
          <div class="panel p-3">
            <p class="etiqueta px-2 py-1">Administrables</p>
            @for (c of administrables; track c.slug) {
              <button
                class="nav-item w-full text-left"
                [class.activo]="slug() === c.slug"
                type="button"
                (click)="seleccionar(c.slug)"
              >
                {{ c.etiqueta }}
              </button>
            }
          </div>
          <div class="panel p-3">
            <p class="etiqueta px-2 py-1">Fijos (solo lectura)</p>
            @for (c of fijos; track c.slug) {
              <button
                class="nav-item w-full text-left"
                [class.activo]="slug() === c.slug"
                type="button"
                (click)="seleccionar(c.slug)"
              >
                {{ c.etiqueta }}
              </button>
            }
          </div>
        </div>

        <!-- Valores -->
        <div class="panel space-y-4 p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="titulo">{{ etiquetaActual() }}</h3>
            @if (!esFijo()) {
              <label class="flex items-center gap-2 text-sm text-slate-400">
                <input type="checkbox" class="accent-neon" [ngModel]="incluirInactivos()" (ngModelChange)="alternarInactivos($event)" name="incluirInactivos" />
                Incluir inactivos
              </label>
            } @else {
              <span class="chip-apagado">catálogo fijo · sin edición (RF-CAT-008)</span>
            }
          </div>

          @if (!esFijo()) {
            <form class="flex flex-wrap items-end gap-3 rounded-lg border border-borde p-3" (ngSubmit)="crear()">
              <div class="grow">
                <label class="campo-etiqueta obligatorio" for="nuevoNombre">Nuevo valor</label>
                <input class="campo" id="nuevoNombre" name="nombre" maxlength="255" required [(ngModel)]="nuevo.nombre" />
              </div>
              <div class="grow">
                <label class="campo-etiqueta" for="nuevaDescripcion">Descripción</label>
                <input class="campo" id="nuevaDescripcion" name="descripcion" maxlength="500" [(ngModel)]="nuevo.descripcion" />
              </div>
              <button class="btn-primario" type="submit" [disabled]="guardando()">Agregar</button>
            </form>
          }

          @if (error()) {
            <p class="alerta-error">{{ error() }}</p>
          }
          @if (cargando()) {
            <p class="etiqueta animate-pulse">Cargando valores…</p>
          } @else {
            <p class="etiqueta">{{ valores().length }} valor(es)</p>
            <table class="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  @if (!esFijo()) {
                    <th class="text-right">Acciones</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (v of valores(); track v.id) {
                  <tr>
                    @if (enEdicion() === v.id) {
                      <td>
                        <input class="campo" name="nombreEdit" maxlength="255" [(ngModel)]="edicion.nombre" />
                      </td>
                      <td>
                        <input class="campo" name="descripcionEdit" maxlength="500" [(ngModel)]="edicion.descripcion" />
                      </td>
                      <td></td>
                      <td class="text-right">
                        <button class="btn-primario btn-mini" type="button" [disabled]="guardando()" (click)="guardarCorreccion(v)">Guardar</button>
                        <button class="btn-secundario btn-mini ml-2" type="button" (click)="enEdicion.set(null)">Cancelar</button>
                      </td>
                    } @else {
                      <td class="text-slate-100">{{ v.nombre }}</td>
                      <td class="max-w-[280px] truncate" [title]="v.descripcion || ''">{{ v.descripcion || '—' }}</td>
                      <td>
                        <span [class]="v.activo ? 'chip-ok' : 'chip-apagado'">{{ v.activo ? 'activo' : 'inactivo' }}</span>
                      </td>
                      @if (!esFijo()) {
                        <td class="text-right">
                          <button class="btn-secundario btn-mini" type="button" (click)="iniciarCorreccion(v)">Corregir</button>
                          @if (v.activo) {
                            <button class="btn-peligro btn-mini ml-2" type="button" (click)="desactivar(v)">Desactivar</button>
                          } @else {
                            <button class="btn-primario btn-mini ml-2" type="button" (click)="reactivar(v)">Reactivar</button>
                          }
                        </td>
                      }
                    }
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  `,
})
export class CatalogosComponent implements OnInit {
  private readonly servicio = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly administrables = CATALOGOS_ADMINISTRABLES;
  readonly fijos = CATALOGOS_FIJOS;

  readonly slug = signal(CATALOGOS_ADMINISTRABLES[0].slug);
  readonly valores = signal<ValorCatalogo[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly incluirInactivos = signal(false);
  readonly enEdicion = signal<string | null>(null);

  nuevo = { nombre: '', descripcion: '' };
  edicion = { nombre: '', descripcion: '' };

  ngOnInit(): void {
    void this.cargar();
  }

  esFijo(): boolean {
    return this.servicio.esFijo(this.slug());
  }

  etiquetaActual(): string {
    return (
      [...this.administrables, ...this.fijos].find((c) => c.slug === this.slug())?.etiqueta ?? ''
    );
  }

  seleccionar(slug: string): void {
    this.slug.set(slug);
    this.enEdicion.set(null);
    this.error.set(null);
    void this.cargar();
  }

  alternarInactivos(valor: boolean): void {
    this.incluirInactivos.set(valor);
    void this.cargar();
  }

  async crear(): Promise<void> {
    if (!this.nuevo.nombre.trim()) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.servicio.crear(this.slug(), {
        nombre: this.nuevo.nombre.trim(),
        descripcion: this.nuevo.descripcion.trim() || undefined,
      });
      this.toast.ok('Valor agregado al catálogo.');
      this.nuevo = { nombre: '', descripcion: '' };
      await this.cargar();
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  iniciarCorreccion(v: ValorCatalogo): void {
    this.enEdicion.set(v.id);
    this.edicion = { nombre: v.nombre, descripcion: v.descripcion ?? '' };
  }

  async guardarCorreccion(v: ValorCatalogo): Promise<void> {
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.servicio.corregir(this.slug(), v.id, {
        nombre: this.edicion.nombre.trim() || undefined,
        descripcion: this.edicion.descripcion.trim() || undefined,
      });
      this.toast.ok('Valor corregido (conserva su identificador).');
      this.enEdicion.set(null);
      await this.cargar();
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async desactivar(v: ValorCatalogo): Promise<void> {
    try {
      await this.servicio.desactivar(this.slug(), v.id);
      this.toast.ok(`"${v.nombre}" desactivado; los registros históricos lo conservan.`);
      await this.cargar();
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async reactivar(v: ValorCatalogo): Promise<void> {
    try {
      await this.servicio.reactivar(this.slug(), v.id);
      this.toast.ok(`"${v.nombre}" reactivado.`);
      await this.cargar();
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      if (this.esFijo()) {
        this.valores.set(await this.servicio.valores(this.slug()));
      } else {
        this.valores.set(
          await this.servicio.listarAdministrable(this.slug(), this.incluirInactivos()),
        );
      }
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
