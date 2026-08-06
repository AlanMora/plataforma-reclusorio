import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificacionesService } from '../core/notificaciones.service';
import { ToastService } from '../core/toast.service';
import { PaginadorComponent } from '../shared/paginador.component';
import { Notificacion, Paginado } from '../core/models';
import { mensajeDe } from '../core/problem';

/** Bandeja personal (RF-NOT-001..004): listar, buscar, paginar, marcar leída. */
@Component({
  selector: 'rw-notificaciones',
  standalone: true,
  imports: [DatePipe, FormsModule, PaginadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl space-y-5">
      <div>
        <p class="etiqueta">Bandeja</p>
        <h2 class="text-2xl font-bold text-slate-100">Notificaciones</h2>
      </div>

      <form class="panel flex items-end gap-3 p-4" (ngSubmit)="buscar()">
        <div class="grow">
          <label class="campo-etiqueta" for="buscarNotif">Buscar en título y mensaje</label>
          <input class="campo" id="buscarNotif" name="buscar" [(ngModel)]="texto" placeholder="Texto libre" />
        </div>
        <button class="btn-primario" type="submit" [disabled]="cargando()">Buscar</button>
      </form>

      @if (error()) {
        <p class="alerta-error">{{ error() }}</p>
      }

      <div class="space-y-2">
        @if (cargando()) {
          <p class="etiqueta animate-pulse">Cargando bandeja…</p>
        } @else if (pagina().items.length === 0) {
          <div class="panel p-10 text-center text-slate-600">Bandeja vacía.</div>
        }
        @for (n of pagina().items; track n.id) {
          <div
            class="panel flex items-start gap-4 p-4"
            [class.opacity-60]="n.leida"
            [class]="!n.leida ? 'border-neon/30' : ''"
          >
            <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" [class]="n.leida ? 'bg-slate-700' : 'bg-neon shadow-[0_0_8px_rgba(34,211,238,.8)]'"></span>
            <div class="grow">
              <p class="font-medium text-slate-100">{{ n.titulo }}</p>
              <p class="mt-0.5 text-sm text-slate-400">{{ n.mensaje }}</p>
              <p class="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-600">
                {{ n.createdAt | date: 'dd/MM/yyyy HH:mm' }}
              </p>
            </div>
            @if (!n.leida) {
              <button class="btn-secundario btn-mini shrink-0" type="button" (click)="marcarLeida(n)">
                Marcar leída
              </button>
            }
          </div>
        }
      </div>

      <rw-paginador
        [page]="pagina().page"
        [totalPages]="pagina().totalPages"
        [total]="pagina().total"
        (cambiar)="cargar($event)"
      />
    </div>
  `,
})
export class NotificacionesComponent implements OnInit {
  private readonly servicio = inject(NotificacionesService);
  private readonly toast = inject(ToastService);

  readonly pagina = signal<Paginado<Notificacion>>({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 });
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  texto = '';

  ngOnInit(): void {
    void this.cargar(1);
  }

  buscar(): void {
    void this.cargar(1);
  }

  async marcarLeida(n: Notificacion): Promise<void> {
    try {
      await this.servicio.marcarLeida(n.id);
      this.pagina.update((p) => ({
        ...p,
        items: p.items.map((x) => (x.id === n.id ? { ...x, leida: true } : x)),
      }));
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async cargar(page: number): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.pagina.set(
        await this.servicio.listar({ buscar: this.texto.trim() || undefined, page, limit: 10 }),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
