import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { normalizarUbicacion } from '../core/ubicaciones-dummy';
import { IconoComponent } from './icono.component';

/** Opción con valor persistible (p. ej. UUID) y etiqueta visible. */
export interface OpcionSelect {
  valor: string;
  etiqueta: string;
}

/** Convierte valores de catálogo ({id, nombre}) en opciones del select. */
export function aOpciones(valores: Array<{ id: string; nombre: string }>): OpcionSelect[] {
  return valores.map((v) => ({ valor: v.id, etiqueta: v.nombre }));
}

/**
 * Select con buscador integrado (RF-GEN: captura asistida por catálogo).
 * Compatible con ngModel/formularios (ControlValueAccessor): se usa igual que
 * un <select>, pero al abrirlo ofrece un campo para filtrar las opciones
 * ignorando acentos y mayúsculas.
 */
@Component({
  selector: 'rw-select-buscable',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-buscable.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectBuscableComponent),
      multi: true,
    },
  ],
})
export class SelectBuscableComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Cadenas simples (valor = etiqueta) u objetos {valor, etiqueta} (p. ej. UUID + nombre). */
  readonly opciones = input<Array<string | OpcionSelect>>([]);
  readonly placeholder = input('— Seleccione —');
  /** id del botón, para asociarlo con el label del formulario. */
  readonly idCampo = input('');

  readonly valor = signal('');
  readonly abierto = signal(false);
  readonly filtro = signal('');
  readonly deshabilitado = signal(false);

  private readonly normalizadas = computed<OpcionSelect[]>(() =>
    this.opciones().map((o) => (typeof o === 'string' ? { valor: o, etiqueta: o } : o)),
  );

  readonly filtradas = computed(() => {
    const f = normalizarUbicacion(this.filtro());
    const opciones = this.normalizadas();
    return f ? opciones.filter((o) => normalizarUbicacion(o.etiqueta).includes(f)) : opciones;
  });

  /** Texto visible del valor elegido (para UUIDs muestra su nombre). */
  readonly etiquetaSeleccionada = computed(() => {
    const v = this.valor();
    if (!v) return '';
    return this.normalizadas().find((o) => o.valor === v)?.etiqueta ?? v;
  });

  private readonly campoBusqueda = viewChild<ElementRef<HTMLInputElement>>('campoBusqueda');

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  constructor() {
    // Enfoca el buscador en cuanto el desplegable termina de pintarse
    // (el effect corre tras el render, seguro en zoneless).
    effect(() => {
      if (this.abierto()) this.campoBusqueda()?.nativeElement.focus();
    });
  }

  writeValue(valor: string | null): void {
    this.valor.set(valor ?? '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
    if (deshabilitado) this.cerrar();
  }

  alternar(): void {
    if (this.deshabilitado()) return;
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    this.abierto.set(true);
    this.filtro.set('');
  }

  cerrar(): void {
    if (!this.abierto()) return;
    this.abierto.set(false);
    this.filtro.set('');
    this.alTocar();
  }

  elegir(valor: string): void {
    this.valor.set(valor);
    this.alCambiar(valor);
    this.cerrar();
  }

  /** Enter en el buscador elige la primera coincidencia visible. */
  elegirPrimera(evento: Event): void {
    evento.preventDefault();
    const primera = this.filtradas()[0];
    if (primera !== undefined) this.elegir(primera.valor);
  }

  @HostListener('document:click', ['$event'])
  clicFuera(evento: MouseEvent): void {
    if (this.abierto() && !this.host.nativeElement.contains(evento.target as Node)) {
      this.cerrar();
    }
  }
}
