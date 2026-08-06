import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { PaginadorComponent } from '../../shared/paginador.component';
import { Paginado, Persona } from '../../core/models';
import { mensajeDe } from '../../core/problem';

export function nombreCompleto(p: Persona): string {
  return [p.primerNombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ') || '—';
}

/** RF-PER-001/002: búsqueda por nombre, apellidos, alias y CURP; paginada. */
@Component({
  selector: 'rw-personas-list',
  standalone: true,
  imports: [RouterLink, FormsModule, PaginadorComponent, PermisoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-6xl space-y-5">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="etiqueta">Módulo</p>
          <h2 class="text-2xl font-bold text-slate-100">Personas</h2>
        </div>
        <a *rwPermiso="'personas:crear'" class="btn-primario" routerLink="/personas/nueva">+ Nueva persona</a>
      </div>

      <form class="panel flex flex-wrap items-end gap-3 p-4" (ngSubmit)="buscar()">
        <div class="grow">
          <label class="campo-etiqueta" for="buscar">Nombre, apellidos o alias</label>
          <input class="campo" id="buscar" name="buscar" maxlength="150" [(ngModel)]="textoBusqueda" placeholder="Texto libre" />
        </div>
        <div>
          <label class="campo-etiqueta" for="curp">CURP exacta</label>
          <input class="campo font-mono uppercase" id="curp" name="curp" maxlength="18" [(ngModel)]="curpBusqueda" />
        </div>
        <button class="btn-primario" type="submit" [disabled]="cargando()">Buscar</button>
      </form>

      @if (error()) {
        <p class="alerta-error">{{ error() }}</p>
      }

      <div class="panel overflow-x-auto p-2">
        <table class="tabla">
          <thead>
            <tr>
              <th>Nombre completo</th>
              <th>Alias</th>
              <th>CURP</th>
              <th>Edad</th>
              <th>Teléfono</th>
            </tr>
          </thead>
          <tbody>
            @if (cargando()) {
              <tr><td colspan="5" class="py-8 text-center text-slate-500">Consultando el padrón…</td></tr>
            } @else if (pagina().items.length === 0) {
              <tr><td colspan="5" class="py-8 text-center text-slate-500">Sin resultados con los criterios dados.</td></tr>
            } @else {
              @for (p of pagina().items; track p.idPersona) {
                <tr class="cursor-pointer" [routerLink]="['/personas', p.idPersona]">
                  <td class="font-medium text-slate-100">{{ nombreDe(p) }}</td>
                  <td>{{ p.alias || '—' }}</td>
                  <td class="font-mono text-xs">{{ p.curp || '—' }}</td>
                  <td class="font-mono">{{ p.edad ?? '—' }}</td>
                  <td class="font-mono text-xs">{{ p.numeroTelefono || '—' }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
        <rw-paginador
          [page]="pagina().page"
          [totalPages]="pagina().totalPages"
          [total]="pagina().total"
          (cambiar)="irAPagina($event)"
        />
      </div>
    </div>
  `,
})
export class PersonasListComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly pagina = signal<Paginado<Persona>>({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  textoBusqueda = '';
  curpBusqueda = '';

  nombreDe = nombreCompleto;

  ngOnInit(): void {
    void this.cargar(1);
  }

  buscar(): void {
    void this.cargar(1);
  }

  irAPagina(pagina: number): void {
    void this.cargar(pagina);
  }

  private async cargar(page: number): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.pagina.set(
        await this.api.get<Paginado<Persona>>('/api/v1/personas', {
          buscar: this.textoBusqueda.trim() || undefined,
          curp: this.curpBusqueda.trim() || undefined,
          page,
          limit: 20,
        }),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
