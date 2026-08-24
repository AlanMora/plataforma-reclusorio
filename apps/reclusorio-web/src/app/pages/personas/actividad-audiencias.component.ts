import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { SelectBuscableComponent, aOpciones } from '../../shared/select-buscable.component';
import { ElementoPickerComponent, nombreElemento } from '../../shared/elemento-picker.component';
import { ElementoCardComponent } from '../../shared/elemento-card.component';
import { Audiencia, Elemento, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { RevisionRegistroComponent } from '../../shared/revision-registro.component';
import { ModalFormulario } from '../../shared/modal-formulario/modal-formulario';
import { IconoComponent } from '../../shared/icono.component';
import {
  fechaParaApi,
  presentarErrorFormulario,
  validarFormulario,
} from '../../core/validacion-formulario';

/**
 * Audiencias (RF-AUD-001..008): datos jurídicos, clasificación, coherencia
 * de próxima audiencia (si es NO la fecha siguiente queda deshabilitada)
 * y asociación de elementos participantes sin duplicar (RF-AUD-006).
 */
@Component({
  selector: 'rw-actividad-audiencias',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    PermisoDirective,
    ArchivosPanelComponent,
    ElementoPickerComponent,
    ElementoCardComponent,
    SelectorFechaComponent,
    SelectBuscableComponent,
    RevisionRegistroComponent,
    ModalFormulario,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './actividad-audiencias.component.html',
})
export class ActividadAudienciasComponent implements OnInit {
  /** Adapta valores de catálogo a opciones del select buscable. */
  readonly aOpciones = aOpciones;

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
  /** Elementos elegidos durante la captura; se asocian al crear (RF-AUD-006). */
  readonly elementosCaptura = signal<Elemento[]>([]);
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

  /** Abre/cierra la captura descartando lo tecleado en un intento previo. */
  alternarForm(): void {
    this.mostrarForm.set(!this.mostrarForm());
    this.limpiarCaptura();
  }

  /** Deja el formulario en blanco para la siguiente captura. */
  private limpiarCaptura(): void {
    this.forma = {
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
    this.archivosCaptura = [];
    this.elementosCaptura.set([]);
    this.proximaEsNo.set(false);
    this.errorForm.set(null);
  }

  agregarElementoCaptura(elemento: Elemento): void {
    if (this.elementosCaptura().some((e) => e.idElemento === elemento.idElemento)) {
      this.toast.error('Ese elemento ya está en la lista de la captura.');
      return;
    }
    this.elementosCaptura.update((lista) => [...lista, elemento]);
  }

  quitarElementoCaptura(idElemento: string): void {
    this.elementosCaptura.update((lista) => lista.filter((e) => e.idElemento !== idElemento));
  }

  /** Asocia lo elegido al registro recién creado; un fallo no revierte la captura. */
  private async asociarElementosCaptura(idAudiencia: string): Promise<void> {
    for (const elemento of this.elementosCaptura()) {
      try {
        await this.api.post(`/api/v1/audiencias/${idAudiencia}/elementos`, {
          idElemento: elemento.idElemento,
        });
      } catch (err) {
        this.toast.error(
          `La audiencia se guardó, pero "${nombreElemento(elemento)}" no se pudo asociar: ${mensajeDe(err)}`,
        );
      }
    }
    this.elementosCaptura.set([]);
  }

  /** Archivos elegidos durante la captura (carga integrada, req. 11/08/2026). */
  private archivosCaptura: File[] = [];

  seleccionarArchivosCaptura(evento: Event): void {
    this.archivosCaptura = Array.from((evento.target as HTMLInputElement).files ?? []);
  }

  /** Sube lo elegido al registro recién creado; un fallo no revierte la captura. */
  private async subirArchivosCaptura(referencia: string, id: string): Promise<void> {
    for (const archivo of this.archivosCaptura) {
      const form = new FormData();
      form.append('file', archivo);
      form.append(referencia, id);
      try {
        await this.api.postForm('/api/v1/archivos', form);
      } catch (err) {
        this.toast.error(
          `El registro se guardó, pero "${archivo.name}" no se pudo subir: ${mensajeDe(err)}`,
        );
      }
    }
    this.archivosCaptura = [];
  }

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
        `/api/v1/personas/${this.idPersona()}/audiencias`,
        {
          ...this.forma,
          fecha: fechaParaApi(this.forma['fecha']),
          fechaSiguienteAudiencia: fechaParaApi(this.forma['fechaSiguienteAudiencia']),
        },
      );
      await this.subirArchivosCaptura('idAudiencia', creado['idAudiencia']);
      await this.asociarElementosCaptura(creado['idAudiencia']);
      this.toast.ok('Audiencia registrada.');
      this.mostrarForm.set(false);
      this.limpiarCaptura();
      await this.cargar();
    } catch (err) {
      this.toast.error(presentarErrorFormulario(formulario, evento, err));
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
      const [formas, juzgados, jueces, tipos, modalidades, resoluciones, proximas] =
        await Promise.all([
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
      this.registros.set(
        await this.api.get<Audiencia[]>(`/api/v1/personas/${this.idPersona()}/audiencias`),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
