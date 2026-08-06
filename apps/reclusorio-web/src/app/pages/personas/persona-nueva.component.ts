import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PersonaFormComponent } from './persona-form.component';
import { Persona } from '../../core/models';

@Component({
  selector: 'rw-persona-nueva',
  standalone: true,
  imports: [PersonaFormComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl space-y-5">
      <div>
        <a routerLink="/personas" class="etiqueta hover:text-neon">← Personas</a>
        <h2 class="mt-1 text-2xl font-bold text-slate-100">Registrar persona</h2>
        <p class="mt-1 text-sm text-slate-500">
          Nombre, CURP y fecha de nacimiento son obligatorios (DP-007); el backend
          valida el formato oficial de la CURP.
        </p>
      </div>
      <div class="panel p-6">
        <rw-persona-form modo="crear" (guardada)="alGuardar($event)" />
      </div>
    </div>
  `,
})
export class PersonaNuevaComponent {
  private readonly router = inject(Router);

  alGuardar(persona: Persona): void {
    void this.router.navigate(['/personas', persona.idPersona]);
  }
}
