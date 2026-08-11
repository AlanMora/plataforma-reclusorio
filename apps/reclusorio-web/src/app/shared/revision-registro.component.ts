import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { PermisoDirective } from '../core/permiso.directive';
import { mensajeDe } from '../core/problem';

/**
 * Validación inicial Confirmar/Descartar (P10): chip con el estado del
 * registro y, mientras está PENDIENTE, botones para confirmarlo o
 * descartarlo UNA sola vez (después el backend rechaza cualquier cambio).
 */
@Component({
  selector: 'rw-revision-registro',
  standalone: true,
  imports: [PermisoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (estadoActual() === 'PENDIENTE') {
      <span class="inline-flex items-center gap-1.5">
        <button
          class="btn-primario btn-mini"
          type="button"
          *rwPermiso="permiso()"
          [disabled]="ocupado()"
          title="Confirmar: el registro queda validado y ya no podrá cambiar"
          (click)="marcar('confirmar')"
        >
          Confirmar
        </button>
        <button
          class="btn-peligro btn-mini"
          type="button"
          *rwPermiso="permiso()"
          [disabled]="ocupado()"
          title="Descartar: el registro queda marcado como creado con error"
          (click)="marcar('descartar')"
        >
          Descartar
        </button>
      </span>
    } @else if (estadoActual() === 'CONFIRMADO') {
      <span class="chip-ok">confirmado</span>
    } @else {
      <span class="chip-peligro">descartado</span>
    }
  `,
})
export class RevisionRegistroComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  /** Prefijo del recurso, p. ej. 'ingresos-egresos', 'audiencias', 'incidencias'. */
  readonly recurso = input.required<string>();
  readonly id = input.required<string>();
  readonly estado = input<string | undefined>('PENDIENTE');
  /** Permiso que habilita la validación (el de captura del módulo). */
  readonly permiso = input.required<string>();

  readonly cambiada = output<string>();
  readonly ocupado = signal(false);

  private readonly estadoLocal = signal<string | null>(null);

  estadoActual(): string {
    return this.estadoLocal() ?? this.estado() ?? 'PENDIENTE';
  }

  async marcar(accion: 'confirmar' | 'descartar'): Promise<void> {
    this.ocupado.set(true);
    try {
      const actualizado = await this.api.post<{ estadoRevision: string }>(
        `/api/v1/${this.recurso()}/${this.id()}/${accion}`,
        {},
      );
      this.estadoLocal.set(actualizado.estadoRevision);
      this.cambiada.emit(actualizado.estadoRevision);
      this.toast.ok(
        accion === 'confirmar'
          ? 'Registro confirmado; ya no admite cambios.'
          : 'Registro descartado; queda marcado como creado con error.',
      );
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.ocupado.set(false);
    }
  }
}
