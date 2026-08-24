import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NotificacionesService } from '../core/notificaciones.service';
import { ToastService } from '../core/toast.service';
import { Notificacion, Paginado } from '../core/models';
import { mensajeDe } from '../core/problem';
import { IconoComponent } from '../shared/icono.component';

/**
 * Campana del navbar (RF-NOT-001..004 + tiempo real): contador flotante de
 * no leídas, panel desplegable paginado con leídas/no leídas diferenciadas,
 * "Ver" que marca leída y navega al registro origen, y acceso a la bandeja
 * completa. Se refresca sola cuando llega una notificación por socket.
 */
@Component({
  selector: 'rw-campana',
  standalone: true,
  imports: [DatePipe, RouterLink, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <button
        type="button"
        class="relative text-lg text-slate-400 transition-colors hover:text-neon"
        title="Notificaciones"
        [attr.aria-expanded]="abierto()"
        (click)="alternar()"
      >
        <rw-icono nombre="notificaciones" [tamano]="20" />
        @if (notificaciones.noLeidas() > 0) {
          <!-- Contador flotante de no leídas -->
          <span
            class="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon px-1 font-mono text-[9px] font-bold text-fondo shadow-[0_0_10px_rgba(34,211,238,0.7)]"
          >
            {{ notificaciones.noLeidas() > 99 ? '99+' : notificaciones.noLeidas() }}
          </span>
        }
      </button>

      @if (abierto()) {
        <!-- Cierre al hacer clic fuera -->
        <div class="fixed inset-0 z-30" (click)="abierto.set(false)"></div>

        <div
          class="glass-popover absolute right-0 top-9 z-40 w-96 overflow-hidden rounded-2xl"
        >
          <div class="flex items-center justify-between border-b border-borde px-4 py-2.5">
            <p class="etiqueta">Notificaciones</p>
            <span class="font-mono text-[10px] text-slate-500">
              {{ notificaciones.noLeidas() }} sin leer
            </span>
          </div>

          <div class="max-h-96 overflow-y-auto">
            @if (cargando()) {
              <p class="etiqueta animate-pulse px-4 py-6 text-center">Cargando…</p>
            } @else if (pagina().items.length === 0) {
              <p class="px-4 py-8 text-center text-sm text-slate-600">Sin notificaciones.</p>
            }
            @for (n of pagina().items; track n.id) {
              <div
                class="flex items-start gap-3 border-b border-borde/50 px-4 py-3 transition-colors"
                [class]="n.leida ? 'opacity-55' : 'bg-neon/[0.04]'"
              >
                <span
                  class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  [class]="
                    n.leida ? 'bg-slate-700' : 'bg-neon shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                  "
                ></span>
                <div class="min-w-0 grow">
                  <p class="truncate text-sm font-medium text-slate-100">{{ n.titulo }}</p>
                  <p class="mt-0.5 line-clamp-2 text-xs text-slate-400">{{ n.mensaje }}</p>
                  <p class="mt-1 font-mono text-[9px] uppercase tracking-widest text-slate-600">
                    {{ n.createdAt | date: 'dd/MM/yy HH:mm' }}
                  </p>
                </div>
                <button
                  class="btn-secundario btn-mini shrink-0"
                  type="button"
                  (click)="ver(n)"
                >
                  <rw-icono nombre="revisar" [tamano]="14" />
                  Ver
                </button>
              </div>
            }
          </div>

          <div class="flex items-center justify-between border-t border-borde px-4 py-2">
            <div class="flex items-center gap-2">
              <button
                class="btn-secundario btn-mini"
                type="button"
                [disabled]="pagina().page <= 1"
                (click)="cargar(pagina().page - 1)"
              >
                <rw-icono nombre="anterior" [tamano]="14" />
              </button>
              <span class="font-mono text-[10px] text-slate-500">
                {{ pagina().page }} / {{ pagina().totalPages || 1 }}
              </span>
              <button
                class="btn-secundario btn-mini"
                type="button"
                [disabled]="pagina().page >= pagina().totalPages"
                (click)="cargar(pagina().page + 1)"
              >
                <rw-icono nombre="siguiente" [tamano]="14" />
              </button>
            </div>
            <a
              class="etiqueta hover:text-neon"
              routerLink="/notificaciones"
              (click)="abierto.set(false)"
            >
              Mostrar todas <rw-icono nombre="flecha_derecha" [tamano]="13" />
            </a>
          </div>
        </div>
      }
    </div>
  `,
})
export class CampanaComponent {
  readonly notificaciones = inject(NotificacionesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly abierto = signal(false);
  readonly cargando = signal(false);
  readonly pagina = signal<Paginado<Notificacion>>({
    items: [],
    total: 0,
    page: 1,
    limit: 5,
    totalPages: 0,
  });

  constructor() {
    // Al llegar una notificación por socket con el panel abierto, se refresca.
    effect(() => {
      const viva = this.notificaciones.ultimaEnVivo();
      if (viva && this.abierto()) void this.cargar(1);
    });
  }

  alternar(): void {
    this.abierto.set(!this.abierto());
    if (this.abierto()) void this.cargar(1);
  }

  /** Marca leída y navega al registro que la originó (si trae destino). */
  async ver(n: Notificacion): Promise<void> {
    try {
      if (!n.leida) await this.notificaciones.marcarLeida(n.id);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
    if (n.url) {
      this.abierto.set(false);
      void this.router.navigateByUrl(n.url);
    } else {
      // Sin destino: solo se marca leída y se refleja en el panel.
      await this.cargar(this.pagina().page);
    }
  }

  async cargar(page: number): Promise<void> {
    this.cargando.set(true);
    try {
      this.pagina.set(await this.notificaciones.listar({ page, limit: 5 }));
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
