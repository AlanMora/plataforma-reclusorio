import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ApiService } from '../core/api.service';
import { Archivo } from '../core/models';

/**
 * Caché de URLs firmadas por archivo (evita pedir la misma URL por cada
 * panel que muestre el mismo archivo en la sesión). Si una URL expira, la
 * imagen falla y la miniatura degrada al ícono del tipo.
 */
const urlsFirmadas = new Map<string, Promise<string>>();

/**
 * Miniatura del expediente digital: para imágenes muestra la foto real
 * (URL temporal firmada de MinIO); para el resto, un ícono según el tipo.
 */
@Component({
  selector: 'rw-archivo-miniatura',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (esImagen() && url() && !fallo()) {
      <img
        [src]="url()"
        [alt]="'Miniatura de ' + archivo().nombreOriginal"
        [class]="clases() + ' border border-borde object-cover'"
        loading="lazy"
        (error)="fallo.set(true)"
      />
    } @else if (esImagen() && !fallo()) {
      <span [class]="clases() + ' animate-pulse border border-borde bg-panel-2'"></span>
    } @else {
      <span
        [class]="
          clases() +
          ' grid place-items-center border border-borde bg-panel-2 text-center leading-none'
        "
        [title]="archivo().mimeType"
        aria-hidden="true"
        >{{ icono() }}</span
      >
    }
  `,
})
export class ArchivoMiniaturaComponent {
  private readonly api = inject(ApiService);

  readonly archivo = input.required<Archivo>();
  /** sm = celda de tabla (40px); lg = tarjeta de biblioteca (56px). */
  readonly tamano = input<'sm' | 'lg'>('sm');

  readonly url = signal<string | null>(null);
  readonly fallo = signal(false);

  readonly esImagen = computed(() => this.archivo().mimeType.startsWith('image/'));
  readonly clases = computed(() =>
    this.tamano() === 'lg'
      ? 'block h-14 w-14 shrink-0 rounded-lg text-2xl'
      : 'block h-10 w-10 shrink-0 rounded-md text-lg',
  );

  constructor() {
    effect(() => {
      const archivo = this.archivo();
      this.url.set(null);
      this.fallo.set(false);
      if (!archivo.mimeType.startsWith('image/')) return;
      let pendiente = urlsFirmadas.get(archivo.idArchivo);
      if (!pendiente) {
        pendiente = this.api
          .get<{ url: string }>(`/api/v1/archivos/${archivo.idArchivo}/descarga`)
          .then((r) => r.url);
        urlsFirmadas.set(archivo.idArchivo, pendiente);
      }
      pendiente
        .then((url) => this.url.set(url))
        .catch(() => {
          // Sin permiso de descarga o error: queda el ícono de imagen.
          urlsFirmadas.delete(archivo.idArchivo);
          this.fallo.set(true);
        });
    });
  }

  icono(): string {
    const mime = this.archivo().mimeType;
    if (mime.startsWith('image/')) return '🖼️';
    if (mime === 'application/pdf') return '📄';
    if (mime.startsWith('video/')) return '🎬';
    if (mime.startsWith('audio/')) return '🎵';
    if (mime.startsWith('text/')) return '📃';
    return '📎';
  }
}
