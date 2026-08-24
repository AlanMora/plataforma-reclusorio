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
import { Movimiento, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { RevisionRegistroComponent } from '../../shared/revision-registro.component';
import { ModalFormulario } from '../../shared/modal-formulario/modal-formulario';
import { IconoComponent } from '../../shared/icono.component';
import {
  fechaParaApi,
  presentarErrorFormulario,
  validarFormulario,
} from '../../core/validacion-formulario';

/** Movimientos internos/externos de la persona (RF-MOV-001..005). */
@Component({
  selector: 'rw-actividad-movimientos',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    PermisoDirective,
    ArchivosPanelComponent,
    SelectorFechaComponent,
    SelectBuscableComponent,
    RevisionRegistroComponent,
    ModalFormulario,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './actividad-movimientos.component.html',
})
export class ActividadMovimientosComponent implements OnInit {
  /** Adapta valores de catálogo a opciones del select buscable. */
  readonly aOpciones = aOpciones;

  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<Movimiento[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly expandido = signal<string | null>(null);

  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly motivos = signal<ValorCatalogo[]>([]);
  readonly centros = signal<ValorCatalogo[]>([]);
  mapaTipos = new Map<string, string>();
  mapaMotivos = new Map<string, string>();
  mapaCentros = new Map<string, string>();

  forma: Record<string, string> = {
    idTipoMovimiento: '',
    idMotivoMovimiento: '',
    fecha: '',
    idCentroOrigen: '',
    idCentroDestino: '',
    ubicacion: '',
  };

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargar();
  }

  nombre(mapa: Map<string, string>, id: string): string {
    return mapa.get(id) ?? '…';
  }

  alternarExpandido(id: string): void {
    this.expandido.set(this.expandido() === id ? null : id);
  }

  /** Abre/cierra la captura descartando lo tecleado en un intento previo. */
  alternarForm(): void {
    this.mostrarForm.set(!this.mostrarForm());
    this.limpiarCaptura();
  }

  /** Deja el formulario en blanco para la siguiente captura. */
  private limpiarCaptura(): void {
    this.forma = {
      idTipoMovimiento: '',
      idMotivoMovimiento: '',
      fecha: '',
      idCentroOrigen: '',
      idCentroDestino: '',
      ubicacion: '',
    };
    this.archivosCaptura = [];
    this.errorForm.set(null);
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
        `/api/v1/personas/${this.idPersona()}/movimientos`,
        {
          ...this.forma,
          fecha: fechaParaApi(this.forma['fecha']),
        },
      );
      await this.subirArchivosCaptura('idMovimiento', creado['idMovimiento']);
      this.toast.ok('Movimiento registrado.');
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
      const [tipos, motivos, centros] = await Promise.all([
        this.catalogos.valores('tipo_movimientos'),
        this.catalogos.valores('motivo_movimiento'),
        this.catalogos.valores('centros'),
      ]);
      this.tipos.set(tipos);
      this.motivos.set(motivos);
      this.centros.set(centros);
      this.mapaTipos = new Map(tipos.map((v) => [v.id, v.nombre]));
      this.mapaMotivos = new Map(motivos.map((v) => [v.id, v.nombre]));
      this.mapaCentros = new Map(centros.map((v) => [v.id, v.nombre]));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.registros.set(
        await this.api.get<Movimiento[]>(`/api/v1/personas/${this.idPersona()}/movimientos`),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
