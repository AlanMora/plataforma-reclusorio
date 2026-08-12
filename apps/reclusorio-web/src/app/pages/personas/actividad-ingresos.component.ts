import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { SelectBuscableComponent, aOpciones } from '../../shared/select-buscable.component';
import { IngresoEgreso, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { RevisionRegistroComponent } from '../../shared/revision-registro.component';

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
    SelectBuscableComponent,
    RevisionRegistroComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './actividad-ingresos.component.html',
})
export class ActividadIngresosComponent implements OnInit {
  /** Adapta valores de catálogo a opciones del select buscable. */
  readonly aOpciones = aOpciones;

  /**
   * El modelo guarda la autoridad como TEXTO (Modelo de Datos §3.5), así que
   * el select ofrece los NOMBRES del catálogo de autoridades; los valores
   * libres ya guardados se conservan como opción.
   */
  autoridadesOpciones(): string[] {
    const nombres = this.autoridades().map((a) => a.nombre);
    const actual = this.forma['autoridad'];
    return actual && !nombres.includes(actual) ? [actual, ...nombres] : nombres;
  }

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
  readonly autoridades = signal<ValorCatalogo[]>([]);
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

  /** Archivos elegidos durante la captura (carga integrada, req. 11/08/2026). */
  private archivosCaptura: File[] = [];

  seleccionarArchivosCaptura(evento: Event): void {
    this.archivosCaptura = Array.from((evento.target as HTMLInputElement).files ?? []);
  }

  /** Sube lo elegido al registro recién creado; un fallo no revierte la captura. */
  private async subirArchivosCaptura(referencia: string, id: string): Promise<void> {
    for (const archivo of this.archivosCaptura) {
      const form = new FormData();
      form.append('file', archivo);
      form.append(referencia, id);
      try {
        await this.api.postForm('/api/v1/archivos', form);
      } catch (err) {
        this.toast.error(
          `El registro se guardó, pero "${archivo.name}" no se pudo subir: ${mensajeDe(err)}`,
        );
      }
    }
    this.archivosCaptura = [];
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      const creado = await this.api.post<Record<string, string>>(
        `/api/v1/personas/${this.idPersona()}/ingresos-egresos`,
        {
          ...this.forma,
          fecha: new Date(this.forma['fecha']).toISOString(),
        },
      );
      await this.subirArchivosCaptura('idIngresoEgreso', creado['idIngresoEgreso']);
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
      const [tipos, centros, delitos, autoridades] = await Promise.all([
        this.catalogos.valores('tipo_ingreso_egreso'),
        this.catalogos.valores('centros'),
        this.catalogos.valores('delitos'),
        this.catalogos.valores('autoridad'),
      ]);
      this.tipos.set(tipos);
      this.centros.set(centros);
      this.delitos.set(delitos);
      this.autoridades.set(autoridades);
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
