import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { ElementoPickerComponent, nombreElemento } from '../../shared/elemento-picker.component';
import { nombreCompleto } from '../personas/personas-list.component';
import { Elemento, IncidenciaDetalle, Paginado, Persona, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/** Detalle de incidencia con TODAS sus asociaciones (RF-INC-003..009). */
@Component({
  selector: 'rw-incidencia-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, FormsModule, PermisoDirective, ArchivosPanelComponent, ElementoPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-5xl space-y-5">
      <a routerLink="/incidencias" class="etiqueta hover:text-neon">← Incidencias</a>

      @if (error()) {
        <p class="alerta-error">{{ error() }}</p>
      } @else if (!incidencia()) {
        <p class="etiqueta animate-pulse">Cargando incidencia…</p>
      } @else {
        <div class="panel panel-glow space-y-3 p-6">
          <div class="flex flex-wrap items-center gap-3">
            <span class="chip-alerta">{{ nombreTipo() }}</span>
            <span class="chip-neon">{{ nombreCentro() }}</span>
            <span class="font-mono text-xs text-slate-500">{{ incidencia()!.fecha | date: 'dd/MM/yyyy HH:mm' }}</span>
            @if (incidencia()!.iph) {
              <span class="chip-apagado">IPH {{ incidencia()!.iph }}</span>
            }
          </div>
          <p class="text-slate-200">{{ incidencia()!.descripcion }}</p>
          @if (incidencia()!.primerRespondiente) {
            <p class="text-sm text-slate-400">
              <span class="etiqueta">Primer respondiente (no registrado):</span>
              {{ incidencia()!.primerRespondiente }}
            </p>
          }
          @if (incidencia()!.narrativa) {
            <p class="whitespace-pre-line border-t border-borde pt-3 text-sm text-slate-400">{{ incidencia()!.narrativa }}</p>
          }
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
          <!-- Personas asociadas -->
          <div class="panel space-y-3 p-5">
            <p class="etiqueta">Personas asociadas (RF-INC-003)</p>
            @if (personasAsociadas().length === 0) {
              <p class="text-sm text-slate-600">Sin personas asociadas — la incidencia es válida así.</p>
            }
            @for (p of personasAsociadas(); track p.idPersona) {
              <a class="block rounded-lg border border-borde px-3 py-2 text-sm text-slate-200 hover:border-neon/40" [routerLink]="['/personas', p.idPersona]">
                {{ nombreDePersona(p) }}
                <span class="ml-2 font-mono text-xs text-slate-500">{{ p.curp }}</span>
              </a>
            }
            <div *rwPermiso="'incidencias:asociar'" class="space-y-2 rounded-lg border border-borde bg-panel-2/60 p-3">
              <p class="etiqueta">Asociar persona</p>
              <div class="flex gap-2">
                <input class="campo" name="buscarPersona" [(ngModel)]="textoPersona" placeholder="Nombre, alias o CURP" (keyup.enter)="buscarPersonas()" />
                <button class="btn-secundario" type="button" (click)="buscarPersonas()">Buscar</button>
              </div>
              @for (p of candidatasPersonas(); track p.idPersona) {
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg border border-borde px-3 py-2 text-left text-sm hover:border-neon/50 hover:bg-neon/5"
                  (click)="asociarPersona(p)"
                >
                  <span>{{ nombreDePersona(p) }}</span>
                  <span class="font-mono text-xs text-slate-500">{{ p.curp }}</span>
                </button>
              }
            </div>
          </div>

          <!-- Autoridades + elementos -->
          <div class="space-y-5">
            <div class="panel space-y-3 p-5">
              <p class="etiqueta">Autoridades de apoyo (RF-INC-004)</p>
              @if (incidencia()!.autoridades.length === 0) {
                <p class="text-sm text-slate-600">Sin autoridades asociadas.</p>
              }
              <div class="flex flex-wrap gap-2">
                @for (id of incidencia()!.autoridades; track id) {
                  <span class="chip-neon">{{ nombreAutoridad(id) }}</span>
                }
              </div>
              <div *rwPermiso="'incidencias:asociar'" class="flex gap-2">
                <select class="campo" name="autoridadNueva" [(ngModel)]="autoridadSeleccionada">
                  <option value="" disabled>Selecciona autoridad…</option>
                  @for (a of autoridades(); track a.id) {
                    <option [value]="a.id">{{ a.nombre }}</option>
                  }
                </select>
                <button class="btn-primario btn-mini" type="button" [disabled]="!autoridadSeleccionada" (click)="asociarAutoridad()">
                  Asociar
                </button>
              </div>
            </div>

            <div class="panel space-y-3 p-5">
              <p class="etiqueta">Elementos participantes (RF-INC-005/007)</p>
              @if (elementosAsociados().length === 0) {
                <p class="text-sm text-slate-600">Sin elementos asociados.</p>
              }
              <div class="flex flex-wrap gap-2">
                @for (e of elementosAsociados(); track e.idElemento) {
                  <span [class]="e.primerRespondiente ? 'chip-ok' : 'chip-neon'">
                    {{ e.nombre }}
                    @if (e.primerRespondiente) {
                      · 1er respondiente
                    }
                  </span>
                }
              </div>
              <div *rwPermiso="'incidencias:asociar'">
                <label class="mb-2 flex items-center gap-2 text-sm text-slate-400">
                  <input type="checkbox" class="accent-neon" name="esPrimerRespondiente" [(ngModel)]="marcarPrimerRespondiente" />
                  Marcar como primer respondiente al asociar
                </label>
                <rw-elemento-picker (elegido)="asociarElemento($event)" />
              </div>
            </div>
          </div>
        </div>

        <div class="panel p-5">
          <p class="etiqueta mb-3">Expediente digital de la incidencia (RF-ARC-004)</p>
          <rw-archivos-panel referencia="idIncidencia" [id]="idIncidencia()" />
        </div>
      }
    </div>
  `,
})
export class IncidenciaDetailComponent {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idIncidencia = input.required<string>();

  readonly incidencia = signal<IncidenciaDetalle | null>(null);
  readonly error = signal<string | null>(null);
  readonly personasAsociadas = signal<Persona[]>([]);
  readonly elementosAsociados = signal<{ idElemento: string; nombre: string; primerRespondiente: boolean }[]>([]);
  readonly candidatasPersonas = signal<Persona[]>([]);
  readonly autoridades = signal<ValorCatalogo[]>([]);

  textoPersona = '';
  autoridadSeleccionada = '';
  marcarPrimerRespondiente = false;

  private mapaTipos = new Map<string, string>();
  private mapaCentros = new Map<string, string>();
  private mapaAutoridades = new Map<string, string>();

  nombreDePersona = nombreCompleto;

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
      await this.api.post(`/api/v1/incidencias/${this.idIncidencia()}/personas`, { idPersona: p.idPersona });
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
        detalle.elementos.map(async (e) => {
          const dato = await this.api.get<Elemento>(`/api/v1/elementos/${e.idElemento}`);
          return { idElemento: e.idElemento, nombre: nombreElemento(dato), primerRespondiente: e.primerRespondiente };
        }),
      );
      this.elementosAsociados.set(elementos);
    } catch {
      this.elementosAsociados.set(
        detalle.elementos.map((e) => ({ idElemento: e.idElemento, nombre: e.idElemento.slice(0, 8), primerRespondiente: e.primerRespondiente })),
      );
    }
  }
}
