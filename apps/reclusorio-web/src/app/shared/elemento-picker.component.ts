import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { PermisoDirective } from '../core/permiso.directive';
import { Elemento } from '../core/models';
import { mensajeDe } from '../core/problem';
import { IconoComponent } from './icono.component';

export function nombreElemento(e: Elemento): string {
  return [e.grado, e.primerNombre, e.apellidoPaterno, e.apellidoMaterno].filter(Boolean).join(' ');
}

/**
 * Búsqueda previa de elementos (RF-ELE-001/004) con listado en vivo mientras
 * se teclea y ALTA CONDICIONADA integrada (RF-ELE-002): si tras buscar ninguna
 * coincidencia corresponde, el elemento se registra en el padrón aquí mismo
 * (permiso elementos:crear) y se emite para asociarlo de inmediato — nunca se
 * crea un elemento sin búsqueda previa.
 */
@Component({
  selector: 'rw-elemento-picker',
  standalone: true,
  imports: [FormsModule, PermisoDirective, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './elemento-picker.component.html',
})
export class ElementoPickerComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly elegido = output<Elemento>();
  readonly resultados = signal<Elemento[]>([]);
  readonly buscando = signal(false);
  readonly buscado = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarAlta = signal(false);
  readonly guardando = signal(false);
  readonly errorAlta = signal<string | null>(null);

  numero = '';
  nombre = '';
  adscripcion = '';

  forma: Record<string, string> = {
    grado: '',
    primerNombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    numeroElemento: '',
    adscripcion: '',
  };

  nombreDe = nombreElemento;

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  /** Búsqueda en vivo: se dispara al teclear, con debounce de 350 ms. */
  alTeclear(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    const hayCriterio = [this.numero, this.nombre, this.adscripcion].some(
      (c) => c.trim().length >= 2,
    );
    if (!hayCriterio) {
      this.resultados.set([]);
      this.buscado.set(false);
      return;
    }
    this.temporizador = setTimeout(() => void this.buscar(), 350);
  }

  /**
   * Emite el elemento y deja el buscador LIMPIO para la siguiente captura
   * (requerimiento de usabilidad: asociar varios elementos de corrido).
   */
  elegir(elemento: Elemento): void {
    this.elegido.emit(elemento);
    this.numero = '';
    this.nombre = '';
    this.adscripcion = '';
    this.resultados.set([]);
    this.buscado.set(false);
    this.error.set(null);
    this.cancelarAlta();
  }

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

  /** Abre el alta precargando lo tecleado en la búsqueda previa. */
  abrirAlta(): void {
    const tokens = this.nombre.trim().split(/\s+/).filter(Boolean);
    let primerNombre = '';
    let apellidoPaterno = '';
    let apellidoMaterno = '';
    if (tokens.length === 1) [primerNombre] = tokens;
    else if (tokens.length === 2) [primerNombre, apellidoPaterno] = tokens;
    else if (tokens.length >= 3) {
      primerNombre = tokens.slice(0, tokens.length - 2).join(' ');
      apellidoPaterno = tokens[tokens.length - 2];
      apellidoMaterno = tokens[tokens.length - 1];
    }
    this.forma = {
      grado: '',
      primerNombre,
      apellidoPaterno,
      apellidoMaterno,
      numeroElemento: this.numero.trim(),
      adscripcion: this.adscripcion.trim(),
    };
    this.errorAlta.set(null);
    this.mostrarAlta.set(true);
  }

  cancelarAlta(): void {
    this.mostrarAlta.set(false);
    this.errorAlta.set(null);
  }

  /** RF-ELE-002/003: crea el elemento en el padrón y lo emite para asociar. */
  async registrarYAsociar(): Promise<void> {
    this.guardando.set(true);
    this.errorAlta.set(null);
    try {
      const creado = await this.api.post<Elemento>('/api/v1/elementos', this.forma);
      this.toast.ok('Elemento registrado en el padrón.');
      this.elegir(creado);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }
}
