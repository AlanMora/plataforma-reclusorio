import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Persona } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { calcularEdad } from '../../core/edad';
import { presentarErrorFormulario, validarFormulario } from '../../core/validacion-formulario';
import { conValorActual } from '../../core/ubicaciones-dummy';
import {
  ESTADOS_CIVILES_DUMMY,
  ESTADOS_NACIMIENTO_DUMMY,
  GENEROS_DUMMY,
  NACIONALIDADES_DUMMY,
  NIVELES_EDUCATIVOS_DUMMY,
  OCUPACIONES_DUMMY,
} from '../../core/persona-opciones-dummy';
import { SelectBuscableComponent } from '../../shared/select-buscable.component';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { DomicilioFormComponent } from '../../shared/domicilio-form.component';
import { IconoComponent } from '../../shared/icono.component';

/**
 * Alta y modificación de personas (RF-PER-003/005).
 * DP-007: nombre, CURP y fecha de nacimiento obligatorios (valida el backend;
 * aquí solo se marca la obligatoriedad). Género/estado civil/nivel educativo/
 * nacionalidad/estado de nacimiento: selects con data dummy mientras el equipo
 * entrega los valores oficiales (P3) — el backend sigue aceptando texto.
 */
@Component({
  selector: 'rw-persona-form',
  standalone: true,
  imports: [
    FormsModule,
    SelectBuscableComponent,
    SelectorFechaComponent,
    DomicilioFormComponent,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './persona-form.component.html',
})
export class PersonaFormComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly modo = input.required<'crear' | 'editar'>();
  readonly inicial = input<Persona | null>(null);
  readonly idFormulario = input('formulario-persona');
  readonly mostrarAcciones = input(true);
  readonly guardada = output<Persona>();

  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  /** Sección de domicilio integrada al alta (solo modo crear). */
  private readonly formDomicilio = viewChild<DomicilioFormComponent>('formDomicilio');

  // Nacimiento: hoy incluido, sin futuras (QA 03/09 reemplaza al "máximo ayer"
  // del 31/08). El selector lo acota con [soloPasado]; el backend valida igual.

  modelo: Record<string, string> = {
    primerNombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    fechaNacimiento: '',
    alias: '',
    curp: '',
    genero: '',
    estadoCivil: '',
    nivelEducativo: '',
    ocupacion: '',
    nacionalidad: '',
    estadoNacimiento: '',
    numeroTelefono: '',
  };

  /**
   * Opciones de cada select: catálogo dummy + el valor ya guardado si no está
   * en la lista (registros previos capturados como texto libre).
   */
  generosOpciones(): string[] {
    return conValorActual(GENEROS_DUMMY, this.modelo['genero']);
  }

  estadosCivilesOpciones(): string[] {
    return conValorActual(ESTADOS_CIVILES_DUMMY, this.modelo['estadoCivil']);
  }

  nivelesEducativosOpciones(): string[] {
    return conValorActual(NIVELES_EDUCATIVOS_DUMMY, this.modelo['nivelEducativo']);
  }

  ocupacionesOpciones(): string[] {
    return conValorActual(OCUPACIONES_DUMMY, this.modelo['ocupacion']);
  }

  nacionalidadesOpciones(): string[] {
    return conValorActual(NACIONALIDADES_DUMMY, this.modelo['nacionalidad']);
  }

  estadosNacimientoOpciones(): string[] {
    return conValorActual(ESTADOS_NACIMIENTO_DUMMY, this.modelo['estadoNacimiento']);
  }

  /**
   * El teléfono solo admite dígitos (RF-GEN-004) y máximo 10 (numeración
   * nacional): descarta letras, espacios y símbolos al teclear o pegar.
   * Corrige también el elemento porque ngModel no repinta la vista cuando el
   * valor saneado coincide con el anterior.
   */
  sanearTelefono(input: HTMLInputElement): void {
    const limpio = input.value.replace(/\D+/g, '').slice(0, 10);
    this.modelo['numeroTelefono'] = limpio;
    if (input.value !== limpio) input.value = limpio;
  }

  /** Edad calculada en vivo desde la fecha capturada (RF-GEN-008). */
  edadCalculada(): number | null {
    return calcularEdad(this.modelo['fechaNacimiento']);
  }

  ngOnInit(): void {
    const p = this.inicial();
    if (!p) return;
    for (const clave of Object.keys(this.modelo)) {
      const valor = (p as unknown as Record<string, unknown>)[clave];
      this.modelo[clave] = valor ? String(valor) : '';
    }
    if (this.modelo['fechaNacimiento']) {
      this.modelo['fechaNacimiento'] = this.modelo['fechaNacimiento'].slice(0, 10);
    }
  }

  async guardar(formulario: NgForm, evento: SubmitEvent): Promise<void> {
    const errorValidacion = validarFormulario(formulario, evento);
    if (errorValidacion) {
      this.error.set(null);
      this.toast.error(errorValidacion);
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const cuerpo = { ...this.modelo, curp: this.modelo['curp'].toUpperCase().trim() };
      let persona: Persona;
      if (this.modo() === 'crear') {
        // El alta exige Idempotency-Key (patrón de la plataforma).
        persona = await this.api.post<Persona>('/api/v1/personas', cuerpo, { idempotente: true });
        this.toast.ok('Persona registrada en el padrón.');
        await this.guardarDomicilioIntegrado(persona.idPersona);
      } else {
        const id = this.inicial()?.idPersona ?? '';
        persona = await this.api.patch<Persona>(`/api/v1/personas/${id}`, cuerpo);
        this.toast.ok('Datos de la persona actualizados.');
      }
      this.guardada.emit(persona);
    } catch (err) {
      this.toast.error(presentarErrorFormulario(formulario, evento, err));
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Domicilio capturado durante el registro (integrado, sin pasos
   * posteriores). Si falla, la persona YA quedó registrada: se avisa y el
   * domicilio puede agregarse después desde el expediente.
   */
  private async guardarDomicilioIntegrado(idPersona: string): Promise<void> {
    const formulario = this.formDomicilio();
    if (!formulario?.capturado()) return;
    try {
      await this.api.post(`/api/v1/personas/${idPersona}/domicilios`, formulario.domicilio);
      this.toast.ok('Domicilio registrado junto con la persona.');
    } catch (err) {
      this.toast.error(
        `La persona se registró, pero el domicilio no se pudo guardar: ${mensajeDe(err)}`,
      );
    }
  }
}
