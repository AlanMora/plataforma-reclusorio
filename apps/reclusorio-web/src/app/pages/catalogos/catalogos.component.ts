import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import {
  CATALOGOS_ADMINISTRABLES,
  CATALOGOS_FIJOS,
  CatalogosService,
} from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PaginadorComponent } from '../../shared/paginador.component';
import { Paginado, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { ModalFormulario } from '../../shared/modal-formulario/modal-formulario';
import {
  DomicilioGeocodificado,
  MapaDomicilioComponent,
} from '../../shared/mapa-domicilio.component';
import { presentarErrorFormulario, validarFormulario } from '../../core/validacion-formulario';
import { IconoComponent } from '../../shared/icono.component';

/**
 * Administración de catálogos (RF-CAT-001..010): alta, corrección,
 * desactivar/reactivar (jamás borrar). Los fijos son SOLO lectura.
 * El catálogo activo llega por la ruta (/catalogos/:tipo/:slug) — la
 * selección vive en el árbol del sidebar; aquí solo el listado paginado
 * y el formulario de alta. El dedup normalizado lo aplica el backend.
 */
@Component({
  selector: 'rw-catalogos',
  standalone: true,
  imports: [
    FormsModule,
    MapaDomicilioComponent,
    PaginadorComponent,
    ModalFormulario,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogos.component.html',
})
export class CatalogosComponent {
  private readonly servicio = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  /** Parámetros de la ruta (withComponentInputBinding). */
  readonly tipo = input.required<string>();
  readonly slug = input.required<string>();

  readonly pagina = signal<Paginado<ValorCatalogo>>({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly incluirInactivos = signal(false);
  readonly enEdicion = signal<string | null>(null);
  readonly mostrarForm = signal(false);

  nuevo = { nombre: '', descripcion: '' };
  texto = '';
  edicion = {
    nombre: '',
    descripcion: '',
    latitud: null as number | null,
    longitud: null as number | null,
  };

  readonly esFijo = computed(() => this.tipo() === 'fijos');
  readonly etiquetaActual = computed(
    () =>
      [...CATALOGOS_ADMINISTRABLES, ...CATALOGOS_FIJOS].find((c) => c.slug === this.slug())
        ?.etiqueta ?? this.slug(),
  );
  readonly valorEnEdicion = computed(() => {
    const id = this.enEdicion();
    return id ? (this.pagina().items.find((valor) => valor.id === id) ?? null) : null;
  });

  constructor() {
    // Cambiar de catálogo en el sidebar reinicia listado, edición y formulario.
    effect(() => {
      this.slug();
      this.tipo();
      this.enEdicion.set(null);
      this.mostrarForm.set(false);
      this.error.set(null);
      this.nuevo = { nombre: '', descripcion: '' };
      this.texto = '';
      void this.cargar(1);
    });
  }

  /** El catálogo de centros penitenciarios se edita con mapa (P9). */
  esCentros(): boolean {
    return this.slug() === 'centros';
  }

  /** El mapa fijó la ubicación del centro: solo interesan las coordenadas. */
  alUbicarCentro(dom: DomicilioGeocodificado): void {
    this.edicion.latitud = dom.latitud;
    this.edicion.longitud = dom.longitud;
  }

  irAPagina(pagina: number): void {
    void this.cargar(pagina);
  }

  buscarTexto(): void {
    void this.cargar(1);
  }

  alternarInactivos(valor: boolean): void {
    this.incluirInactivos.set(valor);
    void this.cargar(1);
  }

  abrirAlta(): void {
    this.enEdicion.set(null);
    this.nuevo = { nombre: '', descripcion: '' };
    this.mostrarForm.set(true);
  }

  cerrarAlta(): void {
    this.mostrarForm.set(false);
    this.nuevo = { nombre: '', descripcion: '' };
  }

  cerrarCorreccion(): void {
    this.enEdicion.set(null);
  }

  async crear(formulario: NgForm, evento: SubmitEvent): Promise<void> {
    const errorValidacion = validarFormulario(formulario, evento);
    if (errorValidacion) {
      this.error.set(null);
      this.toast.error(errorValidacion);
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.servicio.crear(this.slug(), {
        nombre: this.nuevo.nombre.trim(),
        descripcion: this.nuevo.descripcion.trim() || undefined,
      });
      this.toast.ok('Valor agregado al catálogo.');
      this.cerrarAlta();
      await this.cargar(1);
    } catch (err) {
      this.toast.error(presentarErrorFormulario(formulario, evento, err));
    } finally {
      this.guardando.set(false);
    }
  }

  iniciarCorreccion(v: ValorCatalogo): void {
    this.mostrarForm.set(false);
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
      this.cerrarCorreccion();
      await this.cargar(this.pagina().page);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async desactivar(v: ValorCatalogo): Promise<void> {
    try {
      await this.servicio.desactivar(this.slug(), v.id);
      this.toast.ok(`"${v.nombre}" desactivado; los registros históricos lo conservan.`);
      await this.cargar(this.pagina().page);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async reactivar(v: ValorCatalogo): Promise<void> {
    try {
      await this.servicio.reactivar(this.slug(), v.id);
      this.toast.ok(`"${v.nombre}" reactivado.`);
      await this.cargar(this.pagina().page);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  private async cargar(paginaNum: number): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      if (this.esFijo()) {
        // Los fijos son pocos y de solo lectura: listado completo sin paginar.
        const valores = await this.servicio.valores(this.slug());
        this.pagina.set({
          items: valores,
          total: valores.length,
          page: 1,
          limit: valores.length || 1,
          totalPages: 1,
        });
      } else {
        this.pagina.set(
          await this.servicio.listarAdministrablePaginado(
            this.slug(),
            this.incluirInactivos(),
            paginaNum,
            10,
            this.texto.trim() || undefined,
          ),
        );
      }
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
