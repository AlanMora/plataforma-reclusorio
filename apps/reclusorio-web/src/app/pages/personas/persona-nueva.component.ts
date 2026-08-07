import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PersonaFormComponent } from './persona-form.component';
import { Persona } from '../../core/models';

@Component({
  selector: 'rw-persona-nueva',
  standalone: true,
  imports: [PersonaFormComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './persona-nueva.component.html',
})
export class PersonaNuevaComponent {
  private readonly router = inject(Router);

  alGuardar(persona: Persona): void {
    void this.router.navigate(['/personas', persona.idPersona]);
  }
}
