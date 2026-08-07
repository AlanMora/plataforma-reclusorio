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
  templateUrl: './notificaciones.component.html',
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
