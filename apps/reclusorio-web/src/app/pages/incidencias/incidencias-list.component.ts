import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { PaginadorComponent } from '../../shared/paginador.component';
import { Incidencia, Paginado } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/** Consulta paginada de incidencias (RF-INC-009). */
@Component({
  selector: 'rw-incidencias-list',
  standalone: true,
  imports: [DatePipe, RouterLink, PermisoDirective, PaginadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-6xl space-y-5">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="etiqueta">Módulo</p>
          <h2 class="text-2xl font-bold text-slate-100">Incidencias</h2>
          <p class="mt-1 text-sm text-slate-500">
            Registro independiente: una incidencia puede existir sin personas asociadas (RF-INC-001/002).
          </p>
        </div>
        <a *rwPermiso="'incidencias:crear'" class="btn-primario" routerLink="/incidencias/nueva">+ Registrar incidencia</a>
      </div>

      @if (error()) {
        <p class="alerta-error">{{ error() }}</p>
      }

      <div class="panel overflow-x-auto p-2">
        <table class="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Centro</th>
              <th>Descripción</th>
              <th>IPH</th>
            </tr>
          </thead>
          <tbody>
            @if (cargando()) {
              <tr><td colspan="5" class="py-8 text-center text-slate-500">Consultando incidencias…</td></tr>
            } @else if (pagina().items.length === 0) {
              <tr><td colspan="5" class="py-8 text-center text-slate-500">Sin incidencias registradas.</td></tr>
            } @else {
              @for (i of pagina().items; track i.idIncidencia) {
                <tr class="cursor-pointer" [routerLink]="['/incidencias', i.idIncidencia]">
                  <td class="font-mono text-xs">{{ i.fecha | date: 'dd/MM/yy HH:mm' }}</td>
                  <td><span class="chip-alerta">{{ tipoDe(i.idTipoIncidencia) }}</span></td>
                  <td class="max-w-[200px] truncate">{{ centroDe(i.idCentroPenitenciario) }}</td>
                  <td class="max-w-[320px] truncate" [title]="i.descripcion">{{ i.descripcion }}</td>
                  <td class="font-mono text-xs">{{ i.iph || '—' }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
        <rw-paginador
          [page]="pagina().page"
          [totalPages]="pagina().totalPages"
          [total]="pagina().total"
          (cambiar)="cargar($event)"
        />
      </div>
    </div>
  `,
})
export class IncidenciasListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);

  readonly pagina = signal<Paginado<Incidencia>>({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  private mapaTipos = new Map<string, string>();
  private mapaCentros = new Map<string, string>();

  ngOnInit(): void {
    void Promise.all([this.catalogos.mapa('tipo_incidencia'), this.catalogos.mapa('centros')])
      .then(([tipos, centros]) => {
        this.mapaTipos = tipos;
        this.mapaCentros = centros;
      })
      .catch(() => undefined);
    void this.cargar(1);
  }

  tipoDe(id: string): string {
    return this.mapaTipos.get(id) ?? '…';
  }
  centroDe(id: string): string {
    return this.mapaCentros.get(id) ?? '…';
  }

  async cargar(page: number): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.pagina.set(await this.api.get<Paginado<Incidencia>>('/api/v1/incidencias', { page, limit: 20 }));
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
