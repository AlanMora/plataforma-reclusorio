import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { abrirHaciaArriba } from './desplegable';
import { IconoComponent } from './icono.component';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const ANIO_MINIMO = 1900;

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Selector de fecha propio (reemplaza a los calendarios nativos del
 * navegador): calendario mensual con selects de mes/año, atajo Hoy/Ahora y,
 * con `conHora`, selects de hora y minuto. Compatible con ngModel
 * (ControlValueAccessor). Emite los MISMOS formatos que los inputs nativos:
 * `YYYY-MM-DD` (fecha) y `YYYY-MM-DDTHH:mm` (fecha y hora), por lo que el
 * resto del código no cambia.
 */
@Component({
  selector: 'rw-selector-fecha',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './selector-fecha.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectorFechaComponent),
      multi: true,
    },
  ],
})
export class SelectorFechaComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** true → incluye hora y minuto (equivalente a datetime-local). */
  readonly conHora = input(false);
  /** id del botón, para asociarlo con el label del formulario. */
  readonly idCampo = input('');
  /** Fecha máxima elegible 'YYYY-MM-DD' (p. ej. ayer para fecha de nacimiento). */
  readonly max = input('');
  /** true → no admite fechas futuras (tope = hoy, recalculado al momento). */
  readonly soloPasado = input(false);

  readonly valor = signal('');
  readonly abierto = signal(false);
  readonly deshabilitado = signal(false);
  readonly mesVisible = signal(new Date().getMonth());
  readonly anioVisible = signal(new Date().getFullYear());
  readonly hora = signal('00');
  readonly minuto = signal('00');
  /** true → el calendario se abre hacia arriba (sin espacio abajo). */
  readonly haciaArriba = signal(false);

  readonly meses = MESES;
  readonly diasSemana = DIAS_SEMANA;
  readonly horas = Array.from({ length: 24 }, (_, i) => dosDigitos(i));
  readonly minutos = Array.from({ length: 60 }, (_, i) => dosDigitos(i));
  readonly anios = computed(() => {
    const partes = descomponer(this.maxEfectivo());
    const tope = partes ? partes.anio : new Date().getFullYear() + 5;
    return Array.from({ length: tope + 1 - ANIO_MINIMO }, (_, i) => ANIO_MINIMO + i);
  });

  /** true si el atajo Hoy/Ahora es válido con el máximo configurado. */
  readonly hoyPermitido = computed(() => {
    const ahora = new Date();
    return !this.excedeMax(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  });

  /** Texto del campo: dd/mm/aaaa [HH:mm]. */
  readonly textoVisible = computed(() => {
    const partes = descomponer(this.valor());
    if (!partes) return '';
    const fecha = `${dosDigitos(partes.dia)}/${dosDigitos(partes.mes + 1)}/${partes.anio}`;
    return this.conHora() ? `${fecha} ${partes.hora}:${partes.minuto}` : fecha;
  });

  /** Celdas del mes visible: null = hueco antes del día 1 (semana inicia lunes). */
  readonly celdas = computed(() => {
    const anio = this.anioVisible();
    const mes = this.mesVisible();
    const huecos = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const dias = new Date(anio, mes + 1, 0).getDate();
    return [
      ...Array.from({ length: huecos }, () => null),
      ...Array.from({ length: dias }, (_, i) => i + 1),
    ];
  });

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: string | null): void {
    this.valor.set(valor ?? '');
    const partes = descomponer(valor ?? '');
    if (partes) {
      this.mesVisible.set(partes.mes);
      this.anioVisible.set(partes.anio);
      this.hora.set(partes.hora);
      this.minuto.set(partes.minuto);
    }
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

  alternar(boton?: HTMLElement): void {
    if (this.deshabilitado()) return;
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    // ~420px: navegación + calendario (+hora). Sin espacio abajo, se abre arriba.
    this.haciaArriba.set(boton ? abrirHaciaArriba(boton, 420) : false);
    const partes = descomponer(this.valor());
    const ahora = new Date();
    this.mesVisible.set(partes?.mes ?? ahora.getMonth());
    this.anioVisible.set(partes?.anio ?? ahora.getFullYear());
    if (this.conHora() && !partes) {
      this.hora.set(dosDigitos(ahora.getHours()));
      this.minuto.set(dosDigitos(ahora.getMinutes()));
    }
    this.abierto.set(true);
  }

  cerrar(): void {
    if (!this.abierto()) return;
    this.abierto.set(false);
    this.alTocar();
  }

  /** Esc con el calendario abierto solo lo cierra, sin llegar al modal contenedor. */
  cerrarConEscape(evento: Event): void {
    if (!this.abierto()) return;
    evento.preventDefault();
    evento.stopPropagation();
    this.cerrar();
  }

  mesAnterior(): void {
    const mes = this.mesVisible();
    if (mes === 0 && this.anioVisible() > ANIO_MINIMO) {
      this.mesVisible.set(11);
      this.anioVisible.update((a) => a - 1);
    } else if (mes > 0) {
      this.mesVisible.set(mes - 1);
    }
  }

  mesSiguiente(): void {
    const mes = this.mesVisible();
    if (mes === 11) {
      this.mesVisible.set(0);
      this.anioVisible.update((a) => a + 1);
    } else {
      this.mesVisible.set(mes + 1);
    }
  }

  esHoy(dia: number): boolean {
    const hoy = new Date();
    return (
      dia === hoy.getDate() &&
      this.mesVisible() === hoy.getMonth() &&
      this.anioVisible() === hoy.getFullYear()
    );
  }

  esSeleccionado(dia: number): boolean {
    const partes = descomponer(this.valor());
    return (
      !!partes &&
      partes.dia === dia &&
      partes.mes === this.mesVisible() &&
      partes.anio === this.anioVisible()
    );
  }

  /** true si el día del mes visible excede la fecha máxima permitida. */
  diaNoPermitido(dia: number): boolean {
    return this.excedeMax(this.anioVisible(), this.mesVisible(), dia);
  }

  /** Tope vigente: el `max` recibido acotado además a hoy cuando `soloPasado`. */
  private maxEfectivo(): string {
    const max = this.max();
    if (!this.soloPasado()) return max;
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
    return max && max < hoy ? max : hoy;
  }

  private excedeMax(anio: number, mes: number, dia: number): boolean {
    const partes = descomponer(this.maxEfectivo());
    if (!partes) return false;
    const fecha = `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(dia)}`;
    const tope = `${partes.anio}-${dosDigitos(partes.mes + 1)}-${dosDigitos(partes.dia)}`;
    return fecha > tope;
  }

  /** Clases del día: seleccionado en neón, hoy con anillo, resto neutro. */
  claseDia(dia: number): string {
    if (this.diaNoPermitido(dia)) return 'cursor-not-allowed text-slate-700 line-through';
    const clases = this.esSeleccionado(dia) ? 'bg-neon/20 font-bold text-neon' : 'text-slate-300';
    return this.esHoy(dia) ? `${clases} ring-1 ring-neon/40` : clases;
  }

  elegirDia(dia: number): void {
    if (this.diaNoPermitido(dia)) return;
    this.emitir(this.anioVisible(), this.mesVisible(), dia);
    if (!this.conHora()) this.cerrar();
  }

  /** El cambio de hora/minuto actualiza el valor si ya hay fecha elegida. */
  cambiarHora(hora: string, minuto: string): void {
    this.hora.set(hora);
    this.minuto.set(minuto);
    const partes = descomponer(this.valor());
    if (partes) this.emitir(partes.anio, partes.mes, partes.dia);
  }

  hoy(): void {
    if (!this.hoyPermitido()) return;
    const ahora = new Date();
    this.mesVisible.set(ahora.getMonth());
    this.anioVisible.set(ahora.getFullYear());
    if (this.conHora()) {
      this.hora.set(dosDigitos(ahora.getHours()));
      this.minuto.set(dosDigitos(ahora.getMinutes()));
    }
    this.emitir(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    if (!this.conHora()) this.cerrar();
  }

  limpiar(): void {
    this.valor.set('');
    this.alCambiar('');
    this.cerrar();
  }

  private emitir(anio: number, mes: number, dia: number): void {
    const fecha = `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(dia)}`;
    const valor = this.conHora() ? `${fecha}T${this.hora()}:${this.minuto()}` : fecha;
    this.valor.set(valor);
    this.alCambiar(valor);
  }

  @HostListener('document:click', ['$event'])
  clicFuera(evento: MouseEvent): void {
    if (this.abierto() && !this.host.nativeElement.contains(evento.target as Node)) {
      this.cerrar();
    }
  }
}

/** Desarma 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm' (mes en base 0). */
function descomponer(
  valor: string,
): { anio: number; mes: number; dia: number; hora: string; minuto: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(valor);
  if (!m) return null;
  return {
    anio: Number(m[1]),
    mes: Number(m[2]) - 1,
    dia: Number(m[3]),
    hora: m[4] ?? '00',
    minuto: m[5] ?? '00',
  };
}
