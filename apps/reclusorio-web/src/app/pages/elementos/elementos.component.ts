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
  templateUrl: './elementos.component.html',
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
