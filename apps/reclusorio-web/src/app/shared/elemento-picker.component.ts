import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Elemento } from '../core/models';
import { mensajeDe } from '../core/problem';

export function nombreElemento(e: Elemento): string {
  return [e.grado, e.primerNombre, e.apellidoPaterno, e.apellidoMaterno].filter(Boolean).join(' ');
}

/**
 * Búsqueda previa de elementos (RF-ELE-001/004): por número y, si no,
 * por nombre/adscripción. Emite el elemento elegido para asociarlo.
 */
@Component({
  selector: 'rw-elemento-picker',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './elemento-picker.component.html',
})
export class ElementoPickerComponent {
  private readonly api = inject(ApiService);

  readonly elegido = output<Elemento>();
  readonly resultados = signal<Elemento[]>([]);
  readonly buscando = signal(false);
  readonly buscado = signal(false);
  readonly error = signal<string | null>(null);

  numero = '';
  nombre = '';
  adscripcion = '';

  nombreDe = nombreElemento;

  async buscar(): Promise<void> {
    this.buscando.set(true);
    this.error.set(null);
    try {
      this.resultados.set(
        await this.api.get<Elemento[]>('/api/v1/elementos/coincidencias', {
          numeroElemento: this.numero.trim() || undefined,
          nombre: this.nombre.trim() || undefined,
          adscripcion: this.adscripcion.trim() || undefined,
        }),
      );
      this.buscado.set(true);
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.buscando.set(false);
    }
  }
}
