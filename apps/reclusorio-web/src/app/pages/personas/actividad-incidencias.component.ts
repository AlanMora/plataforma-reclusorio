import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
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
import { Elemento, Incidencia, IncidenciaDetalle, Paginado } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { RevisionRegistroComponent } from '../../shared/revision-registro.component';

/**
 * Tab de incidencias del expediente: incidencias donde la persona está
 * asociada (RF-INC-003), con elementos participantes consultables y
 * asociables desde aquí (RF-INC-005/007), igual que en audiencias/traslados.
 * Las incidencias se REGISTRAN en su propio módulo (son independientes,
 * RF-INC-001/002); este tab consulta y complementa.
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
    ElementoPickerComponent,
    ElementoCardComponent,
    RevisionRegistroComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './actividad-incidencias.component.html',
})
export class ActividadIncidenciasComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<Incidencia[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly expandido = signal<string | null>(null);
  readonly elementosAsociados = signal<{ elemento: Elemento; primerRespondiente: boolean }[]>([]);

  marcarPrimerRespondiente = false;

  mapaTipos = new Map<string, string>();
  mapaCentros = new Map<string, string>();

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
        this.catalogos.mapa('tipo_incidencia'),
        this.catalogos.mapa('centros'),
      ]);
      this.mapaTipos = tipos;
      this.mapaCentros = centros;
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
