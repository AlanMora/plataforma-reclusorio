import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Paginación server-side estándar de la plataforma (DP-010). */
@Component({
  selector: 'rw-paginador',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 0) {
      <div class="flex items-center justify-between gap-4 px-1 pt-3">
        <span class="etiqueta">{{ total() }} registro(s) · página {{ page() }} / {{ totalPages() }}</span>
        <div class="flex gap-2">
          <button class="btn-secundario btn-mini" [disabled]="page() <= 1" (click)="cambiar.emit(page() - 1)">
            ← Anterior
          </button>
          <button
            class="btn-secundario btn-mini"
            [disabled]="page() >= totalPages()"
            (click)="cambiar.emit(page() + 1)"
          >
            Siguiente →
          </button>
        </div>
      </div>
    }
  `,
})
export class PaginadorComponent {
  readonly page = input(1);
  readonly totalPages = input(0);
  readonly total = input(0);
  readonly cambiar = output<number>();
  readonly hayPaginas = computed(() => this.totalPages() > 1);
}
