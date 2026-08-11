import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { IngresoEgreso, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/** Ingresos y libertades de la persona (RF-IEG-001..005). */
@Component({
  selector: 'rw-actividad-ingresos',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    PermisoDirective,
    ArchivosPanelComponent,
    SelectorFechaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './actividad-ingresos.component.html',
})
export class ActividadIngresosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<IngresoEgreso[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly expandido = signal<string | null>(null);

  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly centros = signal<ValorCatalogo[]>([]);
  readonly delitos = signal<ValorCatalogo[]>([]);
  private mapaTipos = new Map<string, string>();
  private mapaCentros = new Map<string, string>();
  private mapaDelitos = new Map<string, string>();

  forma: Record<string, string> = {
    idTipoIngresoEgreso: '',
    fecha: '',
    idCentroPenitenciario: '',
    idDelito: '',
    ubicacion: '',
    autoridad: '',
  };

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargar();
  }

  alternarExpandido(id: string): void {
    this.expandido.set(this.expandido() === id ? null : id);
  }

  nombreTipo(id: string): string {
    return this.mapaTipos.get(id) ?? '…';
  }
  nombreCentro(id: string): string {
    return this.mapaCentros.get(id) ?? '…';
  }
  nombreDelito(id?: string): string {
    return id ? (this.mapaDelitos.get(id) ?? '…') : '—';
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      await this.api.post(`/api/v1/personas/${this.idPersona()}/ingresos-egresos`, {
        ...this.forma,
        fecha: new Date(this.forma['fecha']).toISOString(),
      });
      this.toast.ok('Ingreso/libertad registrado.');
      this.mostrarForm.set(false);
      this.forma = {
        idTipoIngresoEgreso: '',
        fecha: '',
        idCentroPenitenciario: '',
        idDelito: '',
        ubicacion: '',
        autoridad: '',
      };
      await this.cargar();
    } catch (err) {
      this.errorForm.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [tipos, centros, delitos] = await Promise.all([
        this.catalogos.valores('tipo_ingreso_egreso'),
        this.catalogos.valores('centros'),
        this.catalogos.valores('delitos'),
      ]);
      this.tipos.set(tipos);
      this.centros.set(centros);
      this.delitos.set(delitos);
      this.mapaTipos = new Map(tipos.map((v) => [v.id, v.nombre]));
      this.mapaCentros = new Map(centros.map((v) => [v.id, v.nombre]));
      this.mapaDelitos = new Map(delitos.map((v) => [v.id, v.nombre]));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.registros.set(
        await this.api.get<IngresoEgreso[]>(
          `/api/v1/personas/${this.idPersona()}/ingresos-egresos`,
        ),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
