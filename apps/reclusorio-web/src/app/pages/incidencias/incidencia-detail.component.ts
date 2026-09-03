import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { ElementoPickerComponent } from '../../shared/elemento-picker.component';
import { ElementoCardComponent } from '../../shared/elemento-card.component';
import { nombreCompleto } from '../personas/personas-list.component';
import { Elemento, IncidenciaDetalle, Paginado, Persona, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { IconoComponent } from '../../shared/icono.component';

/** Detalle de incidencia con TODAS sus asociaciones (RF-INC-003..009). */
@Component({
  selector: 'rw-incidencia-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    PermisoDirective,
    ArchivosPanelComponent,
    ElementoPickerComponent,
    ElementoCardComponent,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './incidencia-detail.component.html',
})
export class IncidenciaDetailComponent {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idIncidencia = input.required<string>();

  readonly incidencia = signal<IncidenciaDetalle | null>(null);
  readonly error = signal<string | null>(null);
  readonly personasAsociadas = signal<Persona[]>([]);
  readonly elementosAsociados = signal<{ elemento: Elemento; primerRespondiente: boolean }[]>([]);
  readonly candidatasPersonas = signal<Persona[]>([]);
  readonly autoridades = signal<ValorCatalogo[]>([]);

  textoPersona = '';
  autoridadSeleccionada = '';
  marcarPrimerRespondiente = false;

  private mapaTipos = new Map<string, string>();
  private mapaCentros = new Map<string, string>();
  private mapaAutoridades = new Map<string, string>();

  nombreDePersona = nombreCompleto;

  /** Solo una incidencia pendiente de revisión admite quitar asociaciones. */
  esPendiente(): boolean {
    return this.incidencia()?.estadoRevision === 'PENDIENTE';
  }

  constructor() {
    effect(() => {
      const id = this.idIncidencia();
      if (id) void this.cargar(id);
    });
    void Promise.all([
      this.catalogos.mapa('tipo_incidencia'),
      this.catalogos.mapa('centros'),
      this.catalogos.valores('autoridad'),
    ])
      .then(([tipos, centros, autoridades]) => {
        this.mapaTipos = tipos;
        this.mapaCentros = centros;
        this.autoridades.set(autoridades);
        this.mapaAutoridades = new Map(autoridades.map((a) => [a.id, a.nombre]));
      })
      .catch(() => undefined);
  }

  nombreTipo(): string {
    return this.mapaTipos.get(this.incidencia()?.idTipoIncidencia ?? '') ?? '…';
  }
  nombreCentro(): string {
    return this.mapaCentros.get(this.incidencia()?.idCentroPenitenciario ?? '') ?? '…';
  }
  nombreAutoridad(id: string): string {
    return this.mapaAutoridades.get(id) ?? '…';
  }

  async buscarPersonas(): Promise<void> {
    const texto = this.textoPersona.trim();
    if (!texto) return;
    try {
      const esCurp = /^[A-Z0-9]{18}$/i.test(texto);
      const pagina = await this.api.get<Paginado<Persona>>('/api/v1/personas', {
        buscar: esCurp ? undefined : texto,
        curp: esCurp ? texto : undefined,
        page: 1,
        limit: 5,
      });
      this.candidatasPersonas.set(pagina.items);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async asociarPersona(p: Persona): Promise<void> {
    try {
      await this.api.post(`/api/v1/incidencias/${this.idIncidencia()}/personas`, {
        idPersona: p.idPersona,
      });
      this.toast.ok('Persona asociada a la incidencia.');
      this.candidatasPersonas.set([]);
      this.textoPersona = '';
      await this.cargar(this.idIncidencia());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async asociarAutoridad(): Promise<void> {
    try {
      await this.api.post(`/api/v1/incidencias/${this.idIncidencia()}/autoridades`, {
        idAutoridad: this.autoridadSeleccionada,
      });
      this.toast.ok('Autoridad asociada.');
      this.autoridadSeleccionada = '';
      await this.cargar(this.idIncidencia());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async asociarElemento(e: Elemento): Promise<void> {
    try {
      await this.api.post(`/api/v1/incidencias/${this.idIncidencia()}/elementos`, {
        idElemento: e.idElemento,
        primerRespondiente: this.marcarPrimerRespondiente || undefined,
      });
      this.toast.ok('Elemento asociado.');
      this.marcarPrimerRespondiente = false;
      await this.cargar(this.idIncidencia());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async quitarPersona(p: Persona): Promise<void> {
    try {
      await this.api.delete(`/api/v1/incidencias/${this.idIncidencia()}/personas/${p.idPersona}`);
      this.toast.ok('Persona quitada de la incidencia.');
      await this.cargar(this.idIncidencia());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async quitarAutoridad(idAutoridad: string): Promise<void> {
    try {
      await this.api.delete(
        `/api/v1/incidencias/${this.idIncidencia()}/autoridades/${idAutoridad}`,
      );
      this.toast.ok('Autoridad quitada de la incidencia.');
      await this.cargar(this.idIncidencia());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async quitarElemento(idElemento: string): Promise<void> {
    try {
      await this.api.delete(`/api/v1/incidencias/${this.idIncidencia()}/elementos/${idElemento}`);
      this.toast.ok('Elemento quitado de la incidencia.');
      await this.cargar(this.idIncidencia());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  private async cargar(id: string): Promise<void> {
    this.error.set(null);
    try {
      const detalle = await this.api.get<IncidenciaDetalle>(`/api/v1/incidencias/${id}`);
      this.incidencia.set(detalle);
      void this.cargarAsociados(detalle);
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargarAsociados(detalle: IncidenciaDetalle): Promise<void> {
    try {
      const personas = await Promise.all(
        detalle.personas.map((id) => this.api.get<Persona>(`/api/v1/personas/${id}`)),
      );
      this.personasAsociadas.set(personas);
    } catch {
      this.personasAsociadas.set(detalle.personas.map((id) => ({ idPersona: id })) as Persona[]);
    }
    try {
      const elementos = await Promise.all(
        detalle.elementos.map(async (e) => ({
          elemento: await this.api.get<Elemento>(`/api/v1/elementos/${e.idElemento}`),
          primerRespondiente: e.primerRespondiente,
        })),
      );
      this.elementosAsociados.set(elementos);
    } catch {
      // sin permiso elementos:consultar solo se conoce el identificador
      this.elementosAsociados.set(
        detalle.elementos.map((e) => ({
          elemento: { idElemento: e.idElemento, primerNombre: e.idElemento.slice(0, 8) },
          primerRespondiente: e.primerRespondiente,
        })),
      );
    }
  }
}
