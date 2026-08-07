import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Persona } from '../../core/models';
import { mensajeDe, problemaDe } from '../../core/problem';

/**
 * Alta y modificación de personas (RF-PER-003/005).
 * DP-007: nombre, CURP y fecha de nacimiento obligatorios (valida el backend;
 * aquí solo se marca la obligatoriedad). Género/estado civil: texto libre
 * mientras el equipo define los ENUM (pendiente P3 — no se inventan valores).
 */
@Component({
  selector: 'rw-persona-form',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './persona-form.component.html',
})
export class PersonaFormComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly modo = input.required<'crear' | 'editar'>();
  readonly inicial = input<Persona | null>(null);
  readonly guardada = output<Persona>();

  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

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

  async guardar(): Promise<void> {
    this.guardando.set(true);
    this.error.set(null);
    try {
      const cuerpo = { ...this.modelo, curp: this.modelo['curp'].toUpperCase().trim() };
      let persona: Persona;
      if (this.modo() === 'crear') {
        // El alta exige Idempotency-Key (patrón de la plataforma).
        persona = await this.api.post<Persona>('/api/v1/personas', cuerpo, { idempotente: true });
        this.toast.ok('Persona registrada en el padrón.');
      } else {
        const id = this.inicial()?.idPersona ?? '';
        persona = await this.api.patch<Persona>(`/api/v1/personas/${id}`, cuerpo);
        this.toast.ok('Datos de la persona actualizados.');
      }
      this.guardada.emit(persona);
    } catch (err) {
      const p = problemaDe(err);
      this.error.set(p.errors?.length ? p.errors.join('\n') : mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }
}
