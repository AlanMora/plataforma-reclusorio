import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { ElementoPickerComponent, nombreElemento } from '../../shared/elemento-picker.component';
import { Audiencia, Elemento, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/**
 * Audiencias (RF-AUD-001..008): datos jurídicos, clasificación, coherencia
 * de próxima audiencia (si es NO la fecha siguiente queda deshabilitada)
 * y asociación de elementos participantes sin duplicar (RF-AUD-006).
 */
@Component({
  selector: 'rw-actividad-audiencias',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    PermisoDirective,
    ArchivosPanelComponent,
    ElementoPickerComponent,
    SelectorFechaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './actividad-audiencias.component.html',
})
export class ActividadAudienciasComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly registros = signal<Audiencia[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly expandido = signal<string | null>(null);
  readonly elementosAsociados = signal<Elemento[]>([]);
  readonly proximaEsNo = signal(false);

  readonly formasIngreso = signal<ValorCatalogo[]>([]);
  readonly juzgados = signal<ValorCatalogo[]>([]);
  readonly jueces = signal<ValorCatalogo[]>([]);
  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly modalidades = signal<ValorCatalogo[]>([]);
  readonly resoluciones = signal<ValorCatalogo[]>([]);
  readonly proximas = signal<ValorCatalogo[]>([]);
  mapaTipos = new Map<string, string>();
  mapaJuzgados = new Map<string, string>();
  mapaModalidades = new Map<string, string>();
  mapaResoluciones = new Map<string, string>();
  mapaProximas = new Map<string, string>();

  nombreDeElemento = nombreElemento;

  forma: Record<string, string> = {
    fecha: '',
    ca: '',
    ci: '',
    idFormaIngresoAudiencia: '',
    idJuzgado: '',
    idJuezJuzgado: '',
    nombreJuez: '',
    idTipoAudiencia: '',
    idModalidadAudiencia: '',
    idResolucionAudiencia: '',
    observaciones: '',
    idProximaAudiencia: '',
    fechaSiguienteAudiencia: '',
  };

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargar();
  }

  nombre(mapa: Map<string, string>, id: string): string {
    return mapa.get(id) ?? '…';
  }

  /** RF-AUD-004: si la próxima audiencia es NO, la fecha siguiente se limpia. */
  alCambiarProxima(): void {
    const elegido = this.proximas().find((v) => v.id === this.forma['idProximaAudiencia']);
    const esNo = elegido?.nombre?.trim().toUpperCase() === 'NO';
    this.proximaEsNo.set(esNo);
    if (esNo) this.forma['fechaSiguienteAudiencia'] = '';
  }

  alternarExpandido(id: string): void {
    const nuevo = this.expandido() === id ? null : id;
    this.expandido.set(nuevo);
    this.elementosAsociados.set([]);
    if (nuevo) void this.cargarElementos(nuevo);
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      await this.api.post(`/api/v1/personas/${this.idPersona()}/audiencias`, {
        ...this.forma,
        fecha: new Date(this.forma['fecha']).toISOString(),
        fechaSiguienteAudiencia: this.forma['fechaSiguienteAudiencia']
          ? new Date(this.forma['fechaSiguienteAudiencia']).toISOString()
          : '',
      });
      this.toast.ok('Audiencia registrada.');
      this.mostrarForm.set(false);
      await this.cargar();
    } catch (err) {
      this.errorForm.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async asociarElemento(idAudiencia: string, elemento: Elemento): Promise<void> {
    try {
      await this.api.post(`/api/v1/audiencias/${idAudiencia}/elementos`, {
        idElemento: elemento.idElemento,
      });
      this.toast.ok('Elemento asociado a la audiencia.');
      await this.cargarElementos(idAudiencia);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  private async cargarElementos(idAudiencia: string): Promise<void> {
    try {
      const detalle = await this.api.get<Audiencia>(`/api/v1/audiencias/${idAudiencia}`);
      const elementos = await Promise.all(
        (detalle.elementos ?? []).map((id) => this.api.get<Elemento>(`/api/v1/elementos/${id}`)),
      );
      this.elementosAsociados.set(elementos);
    } catch {
      // el permiso elementos:consultar puede faltar; se muestran solo chips vacíos
    }
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [formas, juzgados, jueces, tipos, modalidades, resoluciones, proximas] =
        await Promise.all([
          this.catalogos.valores('forma_ingreso_audiencia'),
          this.catalogos.valores('juzgados'),
          this.catalogos.valores('juez_juzgados'),
          this.catalogos.valores('tipo_audiencia'),
          this.catalogos.valores('modalidad_audiencia'),
          this.catalogos.valores('resolucion_audiencia'),
          this.catalogos.valores('proxima_audiencia'),
        ]);
      this.formasIngreso.set(formas);
      this.juzgados.set(juzgados);
      this.jueces.set(jueces);
      this.tipos.set(tipos);
      this.modalidades.set(modalidades);
      this.resoluciones.set(resoluciones);
      this.proximas.set(proximas);
      this.mapaTipos = new Map(tipos.map((v) => [v.id, v.nombre]));
      this.mapaJuzgados = new Map(juzgados.map((v) => [v.id, v.nombre]));
      this.mapaModalidades = new Map(modalidades.map((v) => [v.id, v.nombre]));
      this.mapaResoluciones = new Map(resoluciones.map((v) => [v.id, v.nombre]));
      this.mapaProximas = new Map(proximas.map((v) => [v.id, v.nombre]));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.registros.set(
        await this.api.get<Audiencia[]>(`/api/v1/personas/${this.idPersona()}/audiencias`),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
