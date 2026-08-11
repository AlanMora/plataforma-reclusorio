import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { BibliotecaArchivosComponent } from '../../shared/biblioteca-archivos.component';
import { PersonaFormComponent } from './persona-form.component';
import { ActividadIngresosComponent } from './actividad-ingresos.component';
import { ActividadMovimientosComponent } from './actividad-movimientos.component';
import { ActividadAudienciasComponent } from './actividad-audiencias.component';
import { ActividadTrasladosComponent } from './actividad-traslados.component';
import { nombreCompleto } from './personas-list.component';
import { Domicilio, Persona, PersonaDetalle } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { MapaDomicilioComponent } from '../../shared/mapa-domicilio.component';
import { DomicilioFormComponent } from '../../shared/domicilio-form.component';

type Pestana =
  'datos' | 'domicilios' | 'ingresos' | 'movimientos' | 'audiencias' | 'traslados' | 'archivos';

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
    BibliotecaArchivosComponent,
    PersonaFormComponent,
    ActividadIngresosComponent,
    ActividadMovimientosComponent,
    ActividadAudienciasComponent,
    ActividadTrasladosComponent,
    MapaDomicilioComponent,
    DomicilioFormComponent,
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

  /** Domicilio guardado cuyo mapa (solo lectura) está desplegado. */
  readonly mapaAbierto = signal<string | null>(null);

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

  /** Alta de domicilio desde el expediente usando el formulario compartido. */
  async agregarDomicilio(formulario: DomicilioFormComponent): Promise<void> {
    this.guardandoDomicilio.set(true);
    this.errorDomicilio.set(null);
    try {
      await this.api.post<Domicilio>(
        `/api/v1/personas/${this.idPersona()}/domicilios`,
        formulario.domicilio,
      );
      this.toast.ok('Domicilio agregado.');
      this.mostrarFormDomicilio.set(false);
      formulario.reiniciar();
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
