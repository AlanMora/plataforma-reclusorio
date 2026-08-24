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
import { Elemento, Traslado, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { RevisionRegistroComponent } from '../../shared/revision-registro.component';
import { ModalFormulario } from '../../shared/modal-formulario/modal-formulario';
import { IconoComponent } from '../../shared/icono.component';
import {
  fechaParaApi,
  presentarErrorFormulario,
  validarFormulario,
} from '../../core/validacion-formulario';

/** Traslados (RF-TRA-001..007) con elementos participantes (RF-TRA-006). */
@Component({
  selector: 'rw-actividad-traslados',
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
  templateUrl: './actividad-traslados.component.html',
})
export class ActividadTrasladosComponent implements OnInit {
  /** Adapta valores de catálogo a opciones del select buscable. */
  readonly aOpciones = aOpciones;

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
  /** Elementos elegidos durante la captura; se asocian al crear (RF-TRA-006). */
  readonly elementosCaptura = signal<Elemento[]>([]);

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

  /** Abre/cierra la captura descartando lo tecleado en un intento previo. */
  alternarForm(): void {
    this.mostrarForm.set(!this.mostrarForm());
    this.limpiarCaptura();
  }

  /** Deja el formulario en blanco para la siguiente captura. */
  private limpiarCaptura(): void {
    this.forma = {
      fecha: '',
      idTipoTraslado: '',
      idDestinoTraslado: '',
      idEstatusTraslado: '',
      descripcion: '',
      unidades: '',
      observaciones: '',
    };
    this.archivosCaptura = [];
    this.elementosCaptura.set([]);
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
  private async asociarElementosCaptura(idTraslado: string): Promise<void> {
    for (const elemento of this.elementosCaptura()) {
      try {
        await this.api.post(`/api/v1/traslados/${idTraslado}/elementos`, {
          idElemento: elemento.idElemento,
        });
      } catch (err) {
        this.toast.error(
          `El traslado se guardó, pero "${nombreElemento(elemento)}" no se pudo asociar: ${mensajeDe(err)}`,
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
        `/api/v1/personas/${this.idPersona()}/traslados`,
        {
          ...this.forma,
          fecha: fechaParaApi(this.forma['fecha']),
        },
      );
      await this.subirArchivosCaptura('idTraslado', creado['idTraslado']);
      await this.asociarElementosCaptura(creado['idTraslado']);
      this.toast.ok('Traslado registrado.');
      this.mostrarForm.set(false);
      this.limpiarCaptura();
      await this.cargar();
    } catch (err) {
      this.toast.error(presentarErrorFormulario(formulario, evento, err));
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
      this.registros.set(
        await this.api.get<Traslado[]>(`/api/v1/personas/${this.idPersona()}/traslados`),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
