import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { ArchivosCapturaComponent } from '../../shared/archivos-captura.component';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { SelectBuscableComponent, aOpciones } from '../../shared/select-buscable.component';
import { IngresoEgreso, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { RevisionRegistroComponent } from '../../shared/revision-registro.component';
import { ModalFormulario } from '../../shared/modal-formulario/modal-formulario';
import { IconoComponent } from '../../shared/icono.component';
import {
  fechaParaApi,
  presentarErrorFormulario,
  validarFormulario,
} from '../../core/validacion-formulario';

/** Ingresos y libertades de la persona (RF-IEG-001..005). */
@Component({
  selector: 'rw-actividad-ingresos',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    PermisoDirective,
    ArchivosPanelComponent,
    ArchivosCapturaComponent,
    SelectorFechaComponent,
    SelectBuscableComponent,
    RevisionRegistroComponent,
    ModalFormulario,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './actividad-ingresos.component.html',
})
export class ActividadIngresosComponent implements OnInit {
  /** Adapta valores de catálogo a opciones del select buscable. */
  readonly aOpciones = aOpciones;

  /**
   * El modelo guarda la autoridad como TEXTO (Modelo de Datos §3.5), así que
   * el select ofrece los NOMBRES del catálogo de autoridades; los valores
   * libres ya guardados se conservan como opción.
   */
  autoridadesOpciones(): string[] {
    const nombres = this.autoridades().map((a) => a.nombre);
    const actual = this.forma['autoridad'];
    return actual && !nombres.includes(actual) ? [actual, ...nombres] : nombres;
  }

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
  /** Registro completo del renglón expandido (GET por id); la fila es el respaldo. */
  readonly detalle = signal<IngresoEgreso | null>(null);

  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly centros = signal<ValorCatalogo[]>([]);
  readonly delitos = signal<ValorCatalogo[]>([]);
  readonly autoridades = signal<ValorCatalogo[]>([]);
  private mapaTipos = new Map<string, string>();
  private mapaCentros = new Map<string, string>();
  private mapaDelitos = new Map<string, string>();

  forma: Record<string, string> = {
    idTipoIngresoEgreso: '',
    fecha: '',
    idCentroPenitenciario: '',
    idDelito: '',
    ubicacion: '',
    autoridad: '',
  };

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargar();
  }

  alternarExpandido(id: string): void {
    const nuevo = this.expandido() === id ? null : id;
    this.expandido.set(nuevo);
    this.detalle.set(null);
    if (nuevo) void this.cargarDetalle(nuevo);
  }

  /** Trae el registro completo para el detalle expandido. */
  private async cargarDetalle(id: string): Promise<void> {
    try {
      this.detalle.set(await this.api.get<IngresoEgreso>(`/api/v1/ingresos-egresos/${id}`));
    } catch {
      // si el detalle falla, el expandido muestra los datos ya cargados en la fila
    }
  }

  /** Abre/cierra la captura descartando lo tecleado en un intento previo. */
  alternarForm(): void {
    this.mostrarForm.set(!this.mostrarForm());
    this.limpiarCaptura();
  }

  /** Deja el formulario en blanco para la siguiente captura. */
  private limpiarCaptura(): void {
    this.forma = {
      idTipoIngresoEgreso: '',
      fecha: '',
      idCentroPenitenciario: '',
      idDelito: '',
      ubicacion: '',
      autoridad: '',
    };
    this.archivosCaptura()?.limpiar();
    this.errorForm.set(null);
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

  /** Archivos elegidos durante la captura (carga integrada, req. 11/08/2026). */
  private readonly archivosCaptura = viewChild<ArchivosCapturaComponent>('archivosCaptura');

  async crear(formulario: NgForm, evento: SubmitEvent): Promise<void> {
    const errorValidacion = validarFormulario(formulario, evento);
    if (errorValidacion) {
      this.errorForm.set(null);
      this.toast.error(errorValidacion);
      return;
    }
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      const creado = await this.api.post<Record<string, string>>(
        `/api/v1/personas/${this.idPersona()}/ingresos-egresos`,
        {
          ...this.forma,
          fecha: fechaParaApi(this.forma['fecha']),
        },
      );
      await this.archivosCaptura()?.subirA('idIngresoEgreso', creado['idIngresoEgreso']);
      this.toast.ok('Ingreso/libertad registrado.');
      this.mostrarForm.set(false);
      this.limpiarCaptura();
      await this.cargar();
    } catch (err) {
      this.toast.error(presentarErrorFormulario(formulario, evento, err));
    } finally {
      this.guardando.set(false);
    }
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [tipos, centros, delitos, autoridades] = await Promise.all([
        this.catalogos.valores('tipo_ingreso_egreso'),
        this.catalogos.valores('centros'),
        this.catalogos.valores('delitos'),
        this.catalogos.valores('autoridad'),
      ]);
      this.tipos.set(tipos);
      this.centros.set(centros);
      this.delitos.set(delitos);
      this.autoridades.set(autoridades);
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
        await this.api.get<IngresoEgreso[]>(
          `/api/v1/personas/${this.idPersona()}/ingresos-egresos`,
        ),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
