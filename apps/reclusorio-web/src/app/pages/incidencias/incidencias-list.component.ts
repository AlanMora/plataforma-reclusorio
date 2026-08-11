import {
  computed,
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { PaginadorComponent } from '../../shared/paginador.component';
import { Incidencia, Paginado } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { RevisionRegistroComponent } from '../../shared/revision-registro.component';

/** Consulta paginada de incidencias (RF-INC-009). */
@Component({
  selector: 'rw-incidencias-list',
  standalone: true,
  imports: [DatePipe, RouterLink, PermisoDirective, PaginadorComponent, RevisionRegistroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './incidencias-list.component.html',
})
export class IncidenciasListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);

  readonly pagina = signal<Paginado<Incidencia>>({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });

  /** Filas fantasma para que la tabla SIEMPRE mida 10 filas por página. */
  readonly relleno = computed(() =>
    Array.from({ length: Math.max(0, 10 - this.pagina().items.length) }),
  );
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
      this.pagina.set(
        await this.api.get<Paginado<Incidencia>>('/api/v1/incidencias', { page, limit: 10 }),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
