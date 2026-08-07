import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { Movimiento, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/** Movimientos internos/externos de la persona (RF-MOV-001..005). */
@Component({
  selector: 'rw-actividad-movimientos',
  standalone: true,
  imports: [DatePipe, FormsModule, PermisoDirective, ArchivosPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './actividad-movimientos.component.html',
})
export class ActividadMovimientosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<Movimiento[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly expandido = signal<string | null>(null);

  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly motivos = signal<ValorCatalogo[]>([]);
  readonly centros = signal<ValorCatalogo[]>([]);
  mapaTipos = new Map<string, string>();
  mapaMotivos = new Map<string, string>();
  mapaCentros = new Map<string, string>();

  forma: Record<string, string> = { idTipoMovimiento: '', idMotivoMovimiento: '', fecha: '', idCentroOrigen: '', idCentroDestino: '', ubicacion: '' };

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargar();
  }

  nombre(mapa: Map<string, string>, id: string): string {
    return mapa.get(id) ?? '…';
  }

  alternarExpandido(id: string): void {
    this.expandido.set(this.expandido() === id ? null : id);
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      await this.api.post(`/api/v1/personas/${this.idPersona()}/movimientos`, {
        ...this.forma,
        fecha: new Date(this.forma['fecha']).toISOString(),
      });
      this.toast.ok('Movimiento registrado.');
      this.mostrarForm.set(false);
      this.forma = { idTipoMovimiento: '', idMotivoMovimiento: '', fecha: '', idCentroOrigen: '', idCentroDestino: '', ubicacion: '' };
      await this.cargar();
    } catch (err) {
      this.errorForm.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [tipos, motivos, centros] = await Promise.all([
        this.catalogos.valores('tipo_movimientos'),
        this.catalogos.valores('motivo_movimiento'),
        this.catalogos.valores('centros'),
      ]);
      this.tipos.set(tipos);
      this.motivos.set(motivos);
      this.centros.set(centros);
      this.mapaTipos = new Map(tipos.map((v) => [v.id, v.nombre]));
      this.mapaMotivos = new Map(motivos.map((v) => [v.id, v.nombre]));
      this.mapaCentros = new Map(centros.map((v) => [v.id, v.nombre]));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.registros.set(
        await this.api.get<Movimiento[]>(`/api/v1/personas/${this.idPersona()}/movimientos`),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
