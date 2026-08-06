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
  template: `
    <form class="space-y-5" (ngSubmit)="guardar()">
      @if (error()) {
        <p class="alerta-error whitespace-pre-line">{{ error() }}</p>
      }

      <div class="grid gap-4 md:grid-cols-3">
        <div>
          <label class="campo-etiqueta obligatorio" for="primerNombre">Nombre(s)</label>
          <input class="campo" id="primerNombre" name="primerNombre" maxlength="150" required [(ngModel)]="modelo.primerNombre" />
        </div>
        <div>
          <label class="campo-etiqueta" for="apellidoPaterno">Apellido paterno</label>
          <input class="campo" id="apellidoPaterno" name="apellidoPaterno" maxlength="150" [(ngModel)]="modelo.apellidoPaterno" />
        </div>
        <div>
          <label class="campo-etiqueta" for="apellidoMaterno">Apellido materno</label>
          <input class="campo" id="apellidoMaterno" name="apellidoMaterno" maxlength="150" [(ngModel)]="modelo.apellidoMaterno" />
        </div>
        <div>
          <label class="campo-etiqueta obligatorio" for="curp">CURP</label>
          <input
            class="campo font-mono uppercase"
            id="curp"
            name="curp"
            maxlength="18"
            required
            placeholder="18 caracteres"
            [(ngModel)]="modelo.curp"
          />
        </div>
        <div>
          <label class="campo-etiqueta obligatorio" for="fechaNacimiento">Fecha de nacimiento</label>
          <input class="campo" id="fechaNacimiento" name="fechaNacimiento" type="date" required [(ngModel)]="modelo.fechaNacimiento" />
          <p class="mt-1 text-[11px] text-slate-600">La edad SIEMPRE se calcula; nunca se captura (RF-GEN-008).</p>
        </div>
        <div>
          <label class="campo-etiqueta" for="alias">Alias</label>
          <input class="campo" id="alias" name="alias" maxlength="150" [(ngModel)]="modelo.alias" />
        </div>
        <div>
          <label class="campo-etiqueta" for="genero">Género</label>
          <input class="campo" id="genero" name="genero" maxlength="50" [(ngModel)]="modelo.genero" placeholder="Pendiente P3: texto libre" />
        </div>
        <div>
          <label class="campo-etiqueta" for="estadoCivil">Estado civil</label>
          <input class="campo" id="estadoCivil" name="estadoCivil" maxlength="50" [(ngModel)]="modelo.estadoCivil" placeholder="Pendiente P3: texto libre" />
        </div>
        <div>
          <label class="campo-etiqueta" for="nivelEducativo">Nivel educativo</label>
          <input class="campo" id="nivelEducativo" name="nivelEducativo" maxlength="50" [(ngModel)]="modelo.nivelEducativo" />
        </div>
        <div>
          <label class="campo-etiqueta" for="ocupacion">Ocupación</label>
          <input class="campo" id="ocupacion" name="ocupacion" maxlength="50" [(ngModel)]="modelo.ocupacion" />
        </div>
        <div>
          <label class="campo-etiqueta" for="nacionalidad">Nacionalidad</label>
          <input class="campo" id="nacionalidad" name="nacionalidad" maxlength="255" [(ngModel)]="modelo.nacionalidad" />
        </div>
        <div>
          <label class="campo-etiqueta" for="estadoNacimiento">Estado de nacimiento</label>
          <input class="campo" id="estadoNacimiento" name="estadoNacimiento" maxlength="255" [(ngModel)]="modelo.estadoNacimiento" />
        </div>
        <div>
          <label class="campo-etiqueta" for="numeroTelefono">Teléfono</label>
          <input class="campo" id="numeroTelefono" name="numeroTelefono" maxlength="50" [(ngModel)]="modelo.numeroTelefono" />
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <button class="btn-primario" type="submit" [disabled]="guardando()">
          {{ guardando() ? 'Guardando…' : modo() === 'crear' ? 'Registrar persona' : 'Guardar cambios' }}
        </button>
      </div>
    </form>
  `,
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
