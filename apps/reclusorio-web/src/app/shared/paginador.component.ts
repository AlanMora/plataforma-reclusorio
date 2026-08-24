import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconoComponent } from './icono.component';

/** Paginación server-side estándar de la plataforma (DP-010). */
@Component({
  selector: 'rw-paginador',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paginador.component.html',
})
export class PaginadorComponent {
  readonly page = input(1);
  readonly totalPages = input(0);
  readonly total = input(0);
  readonly limit = input(10);
  readonly cambiar = output<number>();

  readonly hayPaginas = computed(() => this.totalPages() > 1);

  /** Rango visual de registros, ej. "1–10" */
  readonly rango = computed(() => {
    const p = this.page();
    const l = this.limit();
    const tot = this.total();
    if (tot === 0) return '0';
    const inicio = (p - 1) * l + 1;
    const fin = Math.min(p * l, tot);
    return `${inicio}–${fin}`;
  });

  /** Lista de números de página y elipses calculadas de forma reactiva */
  readonly itemsPaginacion = computed(() => {
    const total = this.totalPages();
    const actual = this.page();
    if (total <= 1) return [];
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => ({ tipo: 'num' as const, valor: i + 1 }));
    }

    const items: Array<{ tipo: 'num'; valor: number } | { tipo: 'puntos'; valor: number }> = [];

    // Siempre página 1
    items.push({ tipo: 'num', valor: 1 });

    if (actual > 3) {
      items.push({ tipo: 'puntos', valor: Math.max(2, actual - 2) });
    }

    const inicio = Math.max(2, actual - 1);
    const fin = Math.min(total - 1, actual + 1);

    for (let i = inicio; i <= fin; i++) {
      items.push({ tipo: 'num', valor: i });
    }

    if (actual < total - 2) {
      items.push({ tipo: 'puntos', valor: Math.min(total - 1, actual + 2) });
    }

    // Siempre última página
    if (total > 1) {
      items.push({ tipo: 'num', valor: total });
    }

    return items;
  });
}
