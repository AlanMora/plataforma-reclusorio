import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Archivo } from '../core/models';

export type TipoVistaPrevia = 'imagen' | 'pdf' | 'texto' | 'video' | 'audio';

/** Formatos con vista previa nativa del navegador (JPG/PNG/WebP/SVG, PDF, TXT, MP4, MP3). */
export function tipoVistaPrevia(mimeType: string): TipoVistaPrevia | null {
  if (mimeType.startsWith('image/')) return 'imagen';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'texto';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return null;
}

/**
 * Vista previa universal de archivos (requerimiento 11/08/2026): modal que
 * renderiza con el visor nativo del navegador imágenes, PDF, texto, video y
 * audio a partir de la URL temporal de descarga (MinIO).
 */
@Component({
  selector: 'rw-vista-previa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (actual(); as v) {
      <div
        class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
        (click)="cerrar()"
      >
        <div
          class="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-borde bg-panel shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center gap-3 border-b border-borde px-4 py-3">
            <div class="min-w-0 grow">
              <p class="truncate text-sm font-medium text-slate-100">
                {{ v.archivo.nombreOriginal }}
              </p>
              <p class="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                {{ v.archivo.mimeType }}
              </p>
            </div>
            <button
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-borde text-xs text-slate-400 hover:border-neon/40 hover:text-neon"
              type="button"
              title="Cerrar vista previa"
              (click)="cerrar()"
            >
              ✕
            </button>
          </div>
          <div class="grow overflow-auto bg-black/40 p-3">
            @switch (v.tipo) {
              @case ('imagen') {
                <img
                  class="mx-auto max-h-[70vh] rounded"
                  [src]="v.url"
                  [alt]="v.archivo.nombreOriginal"
                />
              }
              @case ('video') {
                <video class="mx-auto max-h-[70vh] w-full rounded" controls [src]="v.url"></video>
              }
              @case ('audio') {
                <audio class="mx-auto mt-10 w-full max-w-xl" controls [src]="v.url"></audio>
              }
              @default {
                <iframe
                  class="h-[70vh] w-full rounded border-0 bg-white"
                  [src]="v.urlSegura"
                  [title]="v.archivo.nombreOriginal"
                ></iframe>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class VistaPreviaComponent {
  private readonly sanitizador = inject(DomSanitizer);

  readonly actual = signal<{
    archivo: Archivo;
    tipo: TipoVistaPrevia;
    url: string;
    urlSegura: SafeResourceUrl;
  } | null>(null);

  abrir(archivo: Archivo, url: string): void {
    const tipo = tipoVistaPrevia(archivo.mimeType);
    if (!tipo) return;
    this.actual.set({
      archivo,
      tipo,
      url,
      // El iframe (PDF/texto) exige URL de recurso confiable; viene de nuestro
      // propio backend (URL temporal firmada de MinIO), no de datos del usuario.
      urlSegura: this.sanitizador.bypassSecurityTrustResourceUrl(url),
    });
  }

  cerrar(): void {
    this.actual.set(null);
  }
}
