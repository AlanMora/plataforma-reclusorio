import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Elemento } from '../core/models';
import { mensajeDe } from '../core/problem';

export function nombreElemento(e: Elemento): string {
  return [e.grado, e.primerNombre, e.apellidoPaterno, e.apellidoMaterno].filter(Boolean).join(' ');
}

/**
 * Búsqueda previa de elementos (RF-ELE-001/004): por número y, si no,
 * por nombre/adscripción. Emite el elemento elegido para asociarlo.
 */
@Component({
  selector: 'rw-elemento-picker',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2 rounded-lg border border-borde bg-panel-2/60 p-3">
      <p class="etiqueta">Buscar elemento del padrón</p>
      <div class="flex flex-wrap gap-2">
        <input
          class="campo max-w-[160px]"
          name="numeroElemento"
          [(ngModel)]="numero"
          placeholder="No. de elemento"
          (keyup.enter)="buscar()"
        />
        <input
          class="campo max-w-[220px]"
          name="nombreElemento"
          [(ngModel)]="nombre"
          placeholder="Nombre"
          (keyup.enter)="buscar()"
        />
        <input
          class="campo max-w-[200px]"
          name="adscripcionElemento"
          [(ngModel)]="adscripcion"
          placeholder="Adscripción"
          (keyup.enter)="buscar()"
        />
        <button class="btn-secundario" type="button" [disabled]="buscando()" (click)="buscar()">
          {{ buscando() ? 'Buscando…' : 'Buscar' }}
        </button>
      </div>

      @if (error()) {
        <p class="alerta-error">{{ error() }}</p>
      }
      @if (buscado() && resultados().length === 0) {
        <p class="text-sm text-slate-500">Sin coincidencias en el padrón.</p>
      }
      @for (e of resultados(); track e.idElemento) {
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-lg border border-borde px-3 py-2 text-left text-sm hover:border-neon/50 hover:bg-neon/5"
          (click)="elegido.emit(e)"
        >
          <span class="text-slate-200">{{ nombreDe(e) }}</span>
          <span class="font-mono text-xs text-slate-500">
            {{ e.numeroElemento || 's/n' }} · {{ e.adscripcion || 'sin adscripción' }}
          </span>
        </button>
      }
    </div>
  `,
})
export class ElementoPickerComponent {
  private readonly api = inject(ApiService);

  readonly elegido = output<Elemento>();
  readonly resultados = signal<Elemento[]>([]);
  readonly buscando = signal(false);
  readonly buscado = signal(false);
  readonly error = signal<string | null>(null);

  numero = '';
  nombre = '';
  adscripcion = '';

  nombreDe = nombreElemento;

  async buscar(): Promise<void> {
    this.buscando.set(true);
    this.error.set(null);
    try {
      this.resultados.set(
        await this.api.get<Elemento[]>('/api/v1/elementos/coincidencias', {
          numeroElemento: this.numero.trim() || undefined,
          nombre: this.nombre.trim() || undefined,
          adscripcion: this.adscripcion.trim() || undefined,
        }),
      );
      this.buscado.set(true);
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.buscando.set(false);
    }
  }
}
