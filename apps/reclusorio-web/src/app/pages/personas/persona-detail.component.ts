import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { BibliotecaArchivosComponent } from '../../shared/biblioteca-archivos.component';
import { PersonaFormComponent } from './persona-form.component';
import { ActividadIngresosComponent } from './actividad-ingresos.component';
import { ActividadMovimientosComponent } from './actividad-movimientos.component';
import { ActividadAudienciasComponent } from './actividad-audiencias.component';
import { ActividadTrasladosComponent } from './actividad-traslados.component';
import { ActividadIncidenciasComponent } from './actividad-incidencias.component';
import { nombreCompleto } from './personas-list.component';
import { Domicilio, Persona, PersonaDetalle } from '../../core/models';
import { calcularEdad } from '../../core/edad';
import { mensajeDe } from '../../core/problem';
import { MapaDomicilioComponent } from '../../shared/mapa-domicilio.component';
import { DomicilioFormComponent } from '../../shared/domicilio-form.component';
import { ModalFormulario } from '../../shared/modal-formulario/modal-formulario';
import { presentarErrorFormulario, validarFormulario } from '../../core/validacion-formulario';
import { IconoComponent } from '../../shared/icono.component';

type Pestana =
  | 'datos'
  | 'domicilios'
  | 'ingresos'
  | 'movimientos'
  | 'audiencias'
  | 'traslados'
  | 'incidencias'
  | 'archivos';

const PESTANAS: { clave: Pestana; etiqueta: string; numero: string }[] = [
  { clave: 'datos', etiqueta: 'Datos generales', numero: '01' },
  { clave: 'domicilios', etiqueta: 'Domicilios', numero: '02' },
  { clave: 'ingresos', etiqueta: 'Ingresos / Libertades', numero: '03' },
  { clave: 'movimientos', etiqueta: 'Movimientos', numero: '04' },
  { clave: 'audiencias', etiqueta: 'Audiencias', numero: '05' },
  { clave: 'traslados', etiqueta: 'Traslados', numero: '06' },
  { clave: 'incidencias', etiqueta: 'Incidencias', numero: '07' },
  { clave: 'archivos', etiqueta: 'Archivos', numero: '08' },
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
    ActividadIncidenciasComponent,
    MapaDomicilioComponent,
    DomicilioFormComponent,
    ModalFormulario,
    IconoComponent,
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
  /** Domicilio en edición dentro del modal; null = alta de domicilio. */
  readonly domicilioEnEdicion = signal<Domicilio | null>(null);

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

  /** Edad del backend o calculada aquí (RF-GEN-008: siempre visible). */
  edad(): number | null {
    const p = this.persona();
    return p ? (p.edad ?? calcularEdad(p.fechaNacimiento)) : null;
  }

  datosGenerales(): { etiqueta: string; valor?: string | number | null }[] {
    const p = this.persona();
    if (!p) return [];
    return [
      { etiqueta: 'Nombre(s)', valor: p.primerNombre },
      { etiqueta: 'Apellido paterno', valor: p.apellidoPaterno },
      { etiqueta: 'Apellido materno', valor: p.apellidoMaterno },
      { etiqueta: 'Fecha de nacimiento', valor: p.fechaNacimiento?.slice(0, 10) },
      { etiqueta: 'Edad (calculada)', valor: this.edad() },
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

  alNavegarPestanas(evento: KeyboardEvent, indice: number): void {
    let destino = indice;

    if (evento.key === 'ArrowRight') destino = (indice + 1) % this.pestanas.length;
    else if (evento.key === 'ArrowLeft')
      destino = (indice - 1 + this.pestanas.length) % this.pestanas.length;
    else if (evento.key === 'Home') destino = 0;
    else if (evento.key === 'End') destino = this.pestanas.length - 1;
    else return;

    evento.preventDefault();
    this.pestana.set(this.pestanas[destino].clave);
    const lista = (evento.currentTarget as HTMLElement).parentElement;
    lista?.querySelectorAll<HTMLButtonElement>('[role="tab"]').item(destino).focus();
  }

  alternarFormDomicilio(): void {
    this.mostrarFormDomicilio.update((visible) => !visible);
    if (!this.mostrarFormDomicilio()) this.domicilioEnEdicion.set(null);
    this.errorDomicilio.set(null);
  }

  /** Abre el modal precargado con un domicilio ya guardado. */
  editarDomicilio(domicilio: Domicilio): void {
    this.domicilioEnEdicion.set(domicilio);
    this.mostrarFormDomicilio.set(true);
    this.errorDomicilio.set(null);
  }

  /** Alta o edición de domicilio desde el expediente usando el formulario compartido. */
  async guardarDomicilio(
    formulario: DomicilioFormComponent,
    formularioAngular: NgForm,
    evento: SubmitEvent,
  ): Promise<void> {
    const errorValidacion = validarFormulario(formularioAngular, evento);
    if (errorValidacion) {
      this.errorDomicilio.set(null);
      this.toast.error(errorValidacion);
      return;
    }
    this.guardandoDomicilio.set(true);
    this.errorDomicilio.set(null);
    const enEdicion = this.domicilioEnEdicion();
    try {
      if (enEdicion?.idDomicilio) {
        await this.api.patch<Domicilio>(
          `/api/v1/personas/${this.idPersona()}/domicilios/${enEdicion.idDomicilio}`,
          formulario.domicilio,
        );
        this.toast.ok('Domicilio actualizado.');
      } else {
        await this.api.post<Domicilio>(
          `/api/v1/personas/${this.idPersona()}/domicilios`,
          formulario.domicilio,
        );
        this.toast.ok('Domicilio agregado.');
      }
      this.mostrarFormDomicilio.set(false);
      this.domicilioEnEdicion.set(null);
      formulario.reiniciar();
      await this.cargar(this.idPersona());
    } catch (err) {
      this.toast.error(presentarErrorFormulario(formularioAngular, evento, err));
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
