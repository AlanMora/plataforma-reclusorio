import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Paginación server-side estándar de la plataforma (DP-010). */
@Component({
  selector: 'rw-paginador',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paginador.component.html',
})
export class PaginadorComponent {
  readonly page = input(1);
  readonly totalPages = input(0);
  readonly total = input(0);
  readonly cambiar = output<number>();
  readonly hayPaginas = computed(() => this.totalPages() > 1);
}
