import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Elemento } from '../core/models';
import { nombreElemento } from './elemento-picker.component';

/**
 * Tarjeta de un elemento asociado: grado + nombre, número de elemento y
 * adscripción, con insignia opcional (p.ej. "1er respondiente").
 */
@Component({
  selector: 'rw-elemento-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center gap-3 rounded-lg border px-3 py-2"
      [class]="
        insignia()
          ? 'border-ok/40 bg-ok/5'
          : 'border-borde bg-panel-2/60'
      "
    >
      <span
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-neon/30 bg-neon/10 font-mono text-[10px] text-neon"
        aria-hidden="true"
      >
        {{ iniciales() }}
      </span>
      <div class="min-w-0">
        <p class="truncate text-sm text-slate-100">{{ nombreDe(elemento()) }}</p>
        <p class="truncate font-mono text-[11px] text-slate-500">
          No. {{ elemento().numeroElemento || 's/n' }} ·
          {{ elemento().adscripcion || 'sin adscripción' }}
        </p>
      </div>
      @if (insignia()) {
        <span class="chip-ok ml-auto shrink-0">{{ insignia() }}</span>
      }
    </div>
  `,
})
export class ElementoCardComponent {
  readonly elemento = input.required<Elemento>();
  /** Texto de insignia opcional, p.ej. "1er respondiente". */
  readonly insignia = input<string>('');

  nombreDe = nombreElemento;

  iniciales(): string {
    const e = this.elemento();
    const letras = [e.primerNombre, e.apellidoPaterno]
      .filter(Boolean)
      .map((p) => (p as string).trim()[0]?.toUpperCase() ?? '')
      .join('');
    return letras || '·';
  }
}
