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
import {
  DomicilioGeocodificado,
  MapaDomicilioComponent,
} from '../../shared/mapa-domicilio.component';

/**
 * Administración de catálogos (RF-CAT-001..010): alta, corrección,
 * desactivar/reactivar (jamás borrar). Los fijos son SOLO lectura.
 * El dedup normalizado (espacios/mayúsculas/acentos) lo aplica el backend.
 */
@Component({
  selector: 'rw-catalogos',
  standalone: true,
  imports: [FormsModule, MapaDomicilioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogos.component.html',
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
  edicion = {
    nombre: '',
    descripcion: '',
    latitud: null as number | null,
    longitud: null as number | null,
  };

  /** El catálogo de centros penitenciarios se edita con mapa (P9). */
  esCentros(): boolean {
    return this.slug() === 'centros';
  }

  /** El mapa fijó la ubicación del centro: solo interesan las coordenadas. */
  alUbicarCentro(dom: DomicilioGeocodificado): void {
    this.edicion.latitud = dom.latitud;
    this.edicion.longitud = dom.longitud;
  }

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
    this.edicion = {
      nombre: v.nombre,
      descripcion: v.descripcion ?? '',
      latitud: v.latitud ?? null,
      longitud: v.longitud ?? null,
    };
  }

  async guardarCorreccion(v: ValorCatalogo): Promise<void> {
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.servicio.corregir(this.slug(), v.id, {
        nombre: this.edicion.nombre.trim() || undefined,
        descripcion: this.edicion.descripcion.trim() || undefined,
        ...(this.esCentros() && this.edicion.latitud !== null && this.edicion.longitud !== null
          ? { latitud: this.edicion.latitud, longitud: this.edicion.longitud }
          : {}),
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
