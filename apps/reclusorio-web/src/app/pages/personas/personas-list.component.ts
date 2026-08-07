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
  templateUrl: './personas-list.component.html',
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
