import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { ArchivosPanelComponent } from '../../shared/archivos-panel.component';
import { PersonaFormComponent } from './persona-form.component';
import { ActividadIngresosComponent } from './actividad-ingresos.component';
import { ActividadMovimientosComponent } from './actividad-movimientos.component';
import { ActividadAudienciasComponent } from './actividad-audiencias.component';
import { ActividadTrasladosComponent } from './actividad-traslados.component';
import { nombreCompleto } from './personas-list.component';
import { Domicilio, Persona, PersonaDetalle } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import {
  DomicilioGeocodificado,
  MapaDomicilioComponent,
} from '../../shared/mapa-domicilio.component';
import { SelectBuscableComponent } from '../../shared/select-buscable.component';
import {
  PAISES_DUMMY,
  canonizar,
  conValorActual,
  estadosDe,
  municipiosDe,
} from '../../core/ubicaciones-dummy';

type Pestana =
  'datos' | 'domicilios' | 'ingresos' | 'movimientos' | 'audiencias' | 'traslados' | 'archivos';

/** Formulario vacío de domicilio; lat/lon se fijan desde el mapa. */
function nuevoDomicilio() {
  return {
    calle: '',
    numeroExterior: '',
    numeroInterior: '',
    cruce1: '',
    cruce2: '',
    colonia: '',
    municipio: '',
    estado: '',
    pais: '',
    latitud: null as number | null,
    longitud: null as number | null,
  };
}

const PESTANAS: { clave: Pestana; etiqueta: string }[] = [
  { clave: 'datos', etiqueta: 'Datos generales' },
  { clave: 'domicilios', etiqueta: 'Domicilios' },
  { clave: 'ingresos', etiqueta: 'Ingresos / Libertades' },
  { clave: 'movimientos', etiqueta: 'Movimientos' },
  { clave: 'audiencias', etiqueta: 'Audiencias' },
  { clave: 'traslados', etiqueta: 'Traslados' },
  { clave: 'archivos', etiqueta: 'Archivos' },
];

/** Expediente de la persona (RF-PER-004): datos, domicilios y actividades. */
@Component({
  selector: 'rw-persona-detail',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    FormsModule,
    PermisoDirective,
    ArchivosPanelComponent,
    PersonaFormComponent,
    ActividadIngresosComponent,
    ActividadMovimientosComponent,
    ActividadAudienciasComponent,
    ActividadTrasladosComponent,
    MapaDomicilioComponent,
    SelectBuscableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './persona-detail.component.html',
})
export class PersonaDetailComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  /** Enlazado desde el parámetro de la ruta (withComponentInputBinding). */
  readonly idPersona = input.required<string>();

  readonly persona = signal<PersonaDetalle | null>(null);
  readonly error = signal<string | null>(null);
  readonly pestana = signal<Pestana>('datos');
  readonly editando = signal(false);
  readonly mostrarFormDomicilio = signal(false);
  readonly guardandoDomicilio = signal(false);
  readonly errorDomicilio = signal<string | null>(null);

  readonly pestanas = PESTANAS;

  domicilio = nuevoDomicilio();

  /** Domicilio guardado cuyo mapa (solo lectura) está desplegado. */
  readonly mapaAbierto = signal<string | null>(null);

  readonly paises = PAISES_DUMMY.map((p) => p.nombre);

  constructor() {
    effect(() => {
      const id = this.idPersona();
      if (id) void this.cargar(id);
    });
  }

  nombre(): string {
    return this.persona() ? nombreCompleto(this.persona()!) : '';
  }

  iniciales(): string {
    const p = this.persona();
    if (!p) return '';
    return ((p.primerNombre?.[0] ?? '') + (p.apellidoPaterno?.[0] ?? '')).toUpperCase() || '?';
  }

  datosGenerales(): { etiqueta: string; valor?: string | number | null }[] {
    const p = this.persona();
    if (!p) return [];
    return [
      { etiqueta: 'Nombre(s)', valor: p.primerNombre },
      { etiqueta: 'Apellido paterno', valor: p.apellidoPaterno },
      { etiqueta: 'Apellido materno', valor: p.apellidoMaterno },
      { etiqueta: 'Fecha de nacimiento', valor: p.fechaNacimiento?.slice(0, 10) },
      { etiqueta: 'Edad (calculada)', valor: p.edad },
      { etiqueta: 'CURP', valor: p.curp },
      { etiqueta: 'Alias', valor: p.alias },
      { etiqueta: 'Género', valor: p.genero },
      { etiqueta: 'Estado civil', valor: p.estadoCivil },
      { etiqueta: 'Nivel educativo', valor: p.nivelEducativo },
      { etiqueta: 'Ocupación', valor: p.ocupacion },
      { etiqueta: 'Nacionalidad', valor: p.nacionalidad },
      { etiqueta: 'Estado de nacimiento', valor: p.estadoNacimiento },
      { etiqueta: 'Teléfono', valor: p.numeroTelefono },
    ];
  }

  alEditar(actualizada: Persona): void {
    this.editando.set(false);
    this.persona.update((actual) => (actual ? { ...actual, ...actualizada } : actual));
  }

  /** Opciones del select de estado: catálogo del país + valor actual si no está. */
  estadosOpciones(): string[] {
    return conValorActual(
      estadosDe(this.domicilio.pais).map((e) => e.nombre),
      this.domicilio.estado,
    );
  }

  /** Opciones del select de municipio: catálogo del estado + valor actual si no está. */
  municipiosOpciones(): string[] {
    return conValorActual(
      municipiosDe(this.domicilio.pais, this.domicilio.estado),
      this.domicilio.municipio,
    );
  }

  paisesOpciones(): string[] {
    return conValorActual(this.paises, this.domicilio.pais);
  }

  alCambiarPais(): void {
    this.domicilio.estado = '';
    this.domicilio.municipio = '';
  }

  alCambiarEstado(): void {
    this.domicilio.municipio = '';
  }

  /** El mapa geocodificó una dirección: llena los campos y guarda lat/lon. */
  alUbicar(dom: DomicilioGeocodificado): void {
    const d = this.domicilio;
    if (dom.calle) d.calle = dom.calle;
    if (dom.numeroExterior) d.numeroExterior = dom.numeroExterior;
    if (dom.colonia) d.colonia = dom.colonia;
    if (dom.pais) d.pais = canonizar(dom.pais, this.paises);
    if (dom.estado)
      d.estado = canonizar(
        dom.estado,
        estadosDe(d.pais).map((e) => e.nombre),
      );
    if (dom.municipio) d.municipio = canonizar(dom.municipio, municipiosDe(d.pais, d.estado));
    d.latitud = dom.latitud;
    d.longitud = dom.longitud;
  }

  async agregarDomicilio(): Promise<void> {
    this.guardandoDomicilio.set(true);
    this.errorDomicilio.set(null);
    try {
      await this.api.post<Domicilio>(
        `/api/v1/personas/${this.idPersona()}/domicilios`,
        this.domicilio,
      );
      this.toast.ok('Domicilio agregado.');
      this.mostrarFormDomicilio.set(false);
      this.domicilio = nuevoDomicilio();
      await this.cargar(this.idPersona());
    } catch (err) {
      this.errorDomicilio.set(mensajeDe(err));
    } finally {
      this.guardandoDomicilio.set(false);
    }
  }

  private async cargar(id: string): Promise<void> {
    this.error.set(null);
    try {
      this.persona.set(await this.api.get<PersonaDetalle>(`/api/v1/personas/${id}`));
    } catch (err) {
      this.error.set(mensajeDe(err));
    }
  }
}
