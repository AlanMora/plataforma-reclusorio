import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { SelectBuscableComponent, aOpciones } from '../../shared/select-buscable.component';
import { ElementoPickerComponent, nombreElemento } from '../../shared/elemento-picker.component';
import { ElementoCardComponent } from '../../shared/elemento-card.component';
import {
  Elemento,
  Incidencia,
  IncidenciaDetalle,
  Paginado,
  ValorCatalogo,
} from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { RevisionRegistroComponent } from '../../shared/revision-registro.component';

/**
 * Tab de incidencias del expediente: incidencias donde la persona está
 * asociada (RF-INC-003), con elementos participantes consultables y
 * asociables desde aquí (RF-INC-005/007), igual que en audiencias/traslados.
 * También permite REGISTRAR una incidencia desde aquí (permiso
 * incidencias:crear): al crearla, la persona del expediente queda asociada
 * automáticamente (RF-INC-003) y los elementos elegidos se asocian de una vez.
 */
@Component({
  selector: 'rw-actividad-incidencias',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    PermisoDirective,
    ArchivosPanelComponent,
    SelectorFechaComponent,
    SelectBuscableComponent,
    ElementoPickerComponent,
    ElementoCardComponent,
    RevisionRegistroComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './actividad-incidencias.component.html',
})
export class ActividadIncidenciasComponent implements OnInit {
  /** Adapta valores de catálogo a opciones del select buscable. */
  readonly aOpciones = aOpciones;

  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<Incidencia[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly expandido = signal<string | null>(null);
  readonly elementosAsociados = signal<{ elemento: Elemento; primerRespondiente: boolean }[]>([]);
  /** Elementos elegidos durante la captura; se asocian al crear (RF-INC-005/007). */
  readonly elementosCaptura = signal<{ elemento: Elemento; primerRespondiente: boolean }[]>([]);

  readonly centros = signal<ValorCatalogo[]>([]);
  readonly tipos = signal<ValorCatalogo[]>([]);

  marcarPrimerRespondiente = false;
  marcarPrimerRespondienteCaptura = false;

  mapaTipos = new Map<string, string>();
  mapaCentros = new Map<string, string>();

  forma: Record<string, string> = {
    idCentroPenitenciario: '',
    idTipoIncidencia: '',
    fecha: '',
    descripcion: '',
    iph: '',
    primerRespondiente: '',
    narrativa: '',
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
    this.marcarPrimerRespondiente = false;
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
      idCentroPenitenciario: '',
      idTipoIncidencia: '',
      fecha: '',
      descripcion: '',
      iph: '',
      primerRespondiente: '',
      narrativa: '',
    };
    this.elementosCaptura.set([]);
    this.marcarPrimerRespondienteCaptura = false;
    this.errorForm.set(null);
  }

  agregarElementoCaptura(elemento: Elemento): void {
    if (this.elementosCaptura().some((e) => e.elemento.idElemento === elemento.idElemento)) {
      this.toast.error('Ese elemento ya está en la lista de la captura.');
      return;
    }
    this.elementosCaptura.update((lista) => [
      ...lista,
      { elemento, primerRespondiente: this.marcarPrimerRespondienteCaptura },
    ]);
    this.marcarPrimerRespondienteCaptura = false;
  }

  quitarElementoCaptura(idElemento: string): void {
    this.elementosCaptura.update((lista) =>
      lista.filter((e) => e.elemento.idElemento !== idElemento),
    );
  }

  /** Asocia lo elegido a la incidencia recién creada; un fallo no revierte la captura. */
  private async asociarElementosCaptura(idIncidencia: string): Promise<void> {
    for (const { elemento, primerRespondiente } of this.elementosCaptura()) {
      try {
        await this.api.post(`/api/v1/incidencias/${idIncidencia}/elementos`, {
          idElemento: elemento.idElemento,
          primerRespondiente: primerRespondiente || undefined,
        });
      } catch (err) {
        this.toast.error(
          `La incidencia se guardó, pero "${nombreElemento(elemento)}" no se pudo asociar: ${mensajeDe(err)}`,
        );
      }
    }
    this.elementosCaptura.set([]);
  }

  /**
   * RF-INC-001/003: crea la incidencia y asocia de inmediato a la persona del
   * expediente (para que aparezca en este tab) y a los elementos elegidos.
   */
  async crear(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      const incidencia = await this.api.post<Incidencia>('/api/v1/incidencias', {
        ...this.forma,
        fecha: new Date(this.forma['fecha']).toISOString(),
      });
      try {
        await this.api.post(`/api/v1/incidencias/${incidencia.idIncidencia}/personas`, {
          idPersona: this.idPersona(),
        });
      } catch (err) {
        this.toast.error(
          `La incidencia se guardó, pero no se pudo asociar a la persona (asóciala desde el módulo Incidencias): ${mensajeDe(err)}`,
        );
      }
      await this.asociarElementosCaptura(incidencia.idIncidencia);
      this.toast.ok('Incidencia registrada.');
      this.mostrarForm.set(false);
      this.limpiarCaptura();
      await this.cargar();
    } catch (err) {
      this.errorForm.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async asociarElemento(idIncidencia: string, elemento: Elemento): Promise<void> {
    try {
      await this.api.post(`/api/v1/incidencias/${idIncidencia}/elementos`, {
        idElemento: elemento.idElemento,
        primerRespondiente: this.marcarPrimerRespondiente || undefined,
      });
      this.toast.ok('Elemento asociado a la incidencia.');
      this.marcarPrimerRespondiente = false;
      await this.cargarElementos(idIncidencia);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  private async cargarElementos(idIncidencia: string): Promise<void> {
    try {
      const detalle = await this.api.get<IncidenciaDetalle>(`/api/v1/incidencias/${idIncidencia}`);
      const elementos = await Promise.all(
        (detalle.elementos ?? []).map(async (e) => ({
          elemento: await this.api.get<Elemento>(`/api/v1/elementos/${e.idElemento}`),
          primerRespondiente: e.primerRespondiente,
        })),
      );
      this.elementosAsociados.set(elementos);
    } catch {
      // sin permiso elementos:consultar solo se omiten los nombres
    }
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [tipos, centros] = await Promise.all([
        this.catalogos.valores('tipo_incidencia'),
        this.catalogos.valores('centros'),
      ]);
      this.tipos.set(tipos);
      this.centros.set(centros);
      this.mapaTipos = new Map(tipos.map((v) => [v.id, v.nombre]));
      this.mapaCentros = new Map(centros.map((v) => [v.id, v.nombre]));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const pagina = await this.api.get<Paginado<Incidencia>>('/api/v1/incidencias', {
        idPersona: this.idPersona(),
        page: 1,
        limit: 100,
      });
      this.registros.set(pagina.items);
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
