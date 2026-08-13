import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComandoAsistente, interpretar } from './asistente-intents';

/** Tipado mínimo del Web Speech API (no viene en lib.dom). */
interface ResultadoVoz {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface ReconocimientoVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: ResultadoVoz) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructorVoz = new () => ReconocimientoVoz;

interface Mensaje {
  rol: 'usuario' | 'asistente';
  texto: string;
}

/**
 * Copiloto de voz del mapa (P11): escucha con el Web Speech API del navegador
 * (es-MX), interpreta la frase con reglas locales (asistente-intents) y emite
 * el comando para que el mapa lo ejecute; la respuesta vuelve por
 * `responder()` y se lee en voz alta con speechSynthesis. Todo ocurre en el
 * navegador: ningún dato del dominio sale del sistema.
 */
@Component({
  selector: 'rw-asistente-mapa',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asistente-mapa.component.html',
})
export class AsistenteMapaComponent implements OnDestroy {
  readonly comando = output<ComandoAsistente>();

  readonly abierto = signal(false);
  readonly escuchando = signal(false);
  readonly pensando = signal(false);
  readonly hablando = signal(false);
  readonly vozSalida = signal(true);
  readonly parcial = signal('');
  readonly mensajes = signal<Mensaje[]>([
    {
      rol: 'asistente',
      texto:
        'Hola, soy el asistente del mapa. Pídeme cosas como "llévame a Puente Grande", ' +
        '"incidencias de este mes", "traslados de la semana" o busca a una persona por su ' +
        'nombre. Toca el micrófono o escribe.',
    },
  ]);

  /** Web Speech API disponible (Chrome/Edge); sin él queda el teclado. */
  readonly soportaVoz = signal(
    typeof window !== 'undefined' &&
      Boolean(
        (window as unknown as Record<string, unknown>)['SpeechRecognition'] ??
          (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'],
      ),
  );

  texto = '';

  @ViewChild('historial') private readonly historial?: ElementRef<HTMLDivElement>;

  private reconocedor: ReconocimientoVoz | null = null;
  /** true mientras el usuario mantiene la escucha activa (auto-reinicio). */
  private escuchaContinua = false;

  ngOnDestroy(): void {
    this.escuchaContinua = false;
    this.reconocedor?.abort();
    window.speechSynthesis?.cancel();
  }

  alternarPanel(): void {
    this.abierto.set(!this.abierto());
    if (!this.abierto()) this.detenerEscucha();
  }

  alternarEscucha(): void {
    if (this.escuchando()) this.detenerEscucha();
    else this.iniciarEscucha();
  }

  alternarVozSalida(): void {
    this.vozSalida.set(!this.vozSalida());
    if (!this.vozSalida()) {
      window.speechSynthesis?.cancel();
      this.hablando.set(false);
    }
  }

  enviarTexto(): void {
    const frase = this.texto.trim();
    if (!frase) return;
    this.texto = '';
    this.procesar(frase);
  }

  usarSugerencia(frase: string): void {
    this.procesar(frase);
  }

  /** El mapa entrega aquí su respuesta; se muestra y (opcional) se lee. */
  responder(texto: string): void {
    this.pensando.set(false);
    this.agregar({ rol: 'asistente', texto });
    if (this.vozSalida()) this.hablar(texto);
  }

  private procesar(frase: string): void {
    this.agregar({ rol: 'usuario', texto: frase });
    this.pensando.set(true);
    window.speechSynthesis?.cancel();
    this.comando.emit(interpretar(frase));
  }

  private iniciarEscucha(): void {
    const ventana = window as unknown as Record<string, unknown>;
    const Ctor = (ventana['SpeechRecognition'] ?? ventana['webkitSpeechRecognition']) as
      | ConstructorVoz
      | undefined;
    if (!Ctor) return;
    // El TTS y el micrófono no conviven: lo que diga el asistente se colaría.
    window.speechSynthesis?.cancel();
    this.hablando.set(false);
    const rec = new Ctor();
    rec.lang = 'es-MX';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let final = '';
      let parcial = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else parcial += r[0].transcript;
      }
      this.parcial.set(parcial);
      if (final.trim()) {
        this.parcial.set('');
        this.procesar(final.trim());
      }
    };
    rec.onend = () => {
      // El API corta solo tras cada frase; si la escucha sigue activa, reinicia.
      if (this.escuchaContinua) {
        try {
          rec.start();
        } catch {
          this.detenerEscucha();
        }
      } else {
        this.escuchando.set(false);
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.escuchaContinua = false;
        this.escuchando.set(false);
        this.agregar({
          rol: 'asistente',
          texto: 'No tengo acceso al micrófono. Autorízalo en el navegador o escribe tu consulta.',
        });
      }
    };
    this.reconocedor = rec;
    this.escuchaContinua = true;
    this.escuchando.set(true);
    rec.start();
  }

  private detenerEscucha(): void {
    this.escuchaContinua = false;
    this.escuchando.set(false);
    this.parcial.set('');
    this.reconocedor?.stop();
  }

  private hablar(texto: string): void {
    const sintesis = window.speechSynthesis;
    if (!sintesis) return;
    sintesis.cancel();
    const enunciado = new SpeechSynthesisUtterance(texto);
    enunciado.lang = 'es-MX';
    const voz =
      sintesis.getVoices().find((v) => v.lang.startsWith('es-MX')) ??
      sintesis.getVoices().find((v) => v.lang.startsWith('es'));
    if (voz) enunciado.voice = voz;
    enunciado.rate = 1.05;
    enunciado.onstart = () => this.hablando.set(true);
    enunciado.onend = () => this.hablando.set(false);
    // Escucha y habla no conviven: si el micrófono está abierto, solo texto.
    if (!this.escuchando()) sintesis.speak(enunciado);
  }

  private agregar(mensaje: Mensaje): void {
    this.mensajes.update((lista) => [...lista, mensaje]);
    setTimeout(() => {
      const caja = this.historial?.nativeElement;
      if (caja) caja.scrollTop = caja.scrollHeight;
    }, 0);
  }
}
