import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { PermisoDirective } from '../core/permiso.directive';
import { Archivo, ReferenciaArchivo } from '../core/models';
import { mensajeDe } from '../core/problem';
import { VistaPreviaComponent, tipoVistaPrevia } from './vista-previa.component';
import { ArchivoMiniaturaComponent } from './archivo-miniatura.component';
import { IconoComponent } from './icono.component';

/**
 * Expediente digital reutilizable (RF-ARC-001..007): lista, sube, descarga
 * y desactiva archivos de UNA entidad (exclusividad RF-ARC-003 garantizada
 * porque el panel siempre manda una sola referencia).
 */
@Component({
  selector: 'rw-archivos-panel',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    PermisoDirective,
    VistaPreviaComponent,
    ArchivoMiniaturaComponent,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './archivos-panel.component.html',
})
export class ArchivosPanelComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  /** Referencia de entidad — exactamente UNA (RF-ARC-003). */
  readonly referencia = input.required<ReferenciaArchivo>();
  readonly id = input.required<string>();

  readonly archivos = signal<Archivo[]>([]);
  readonly cargando = signal(false);
  readonly subiendo = signal(false);
  readonly error = signal<string | null>(null);
  descripcion = '';
  seleccionado: File | null = null;

  constructor() {
    effect(() => {
      const id = this.id();
      const referencia = this.referencia();
      if (id) void this.cargar(referencia, id);
    });
  }

  seleccionar(evento: Event): void {
    this.seleccionado = (evento.target as HTMLInputElement).files?.[0] ?? null;
  }

  async subir(): Promise<void> {
    if (!this.seleccionado) return;
    this.subiendo.set(true);
    this.error.set(null);
    try {
      const form = new FormData();
      form.append('file', this.seleccionado);
      form.append(this.referencia(), this.id());
      if (this.descripcion.trim()) form.append('descripcion', this.descripcion.trim());
      await this.api.postForm<Archivo>('/api/v1/archivos', form);
      this.toast.ok('Archivo subido y verificado (SHA-256).');
      this.seleccionado = null;
      this.descripcion = '';
      await this.cargar(this.referencia(), this.id());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.subiendo.set(false);
    }
  }

  /** Formatos soportados por el visor nativo (imágenes, PDF, TXT, MP4, MP3). */
  puedePrevisualizar(archivo: Archivo): boolean {
    return tipoVistaPrevia(archivo.mimeType) !== null;
  }

  async previsualizar(archivo: Archivo, visor: VistaPreviaComponent): Promise<void> {
    try {
      const { url } = await this.api.get<{ url: string }>(
        `/api/v1/archivos/${archivo.idArchivo}/descarga`,
      );
      visor.abrir(archivo, url);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async descargar(archivo: Archivo): Promise<void> {
    try {
      const { url } = await this.api.get<{ url: string; hashSha256: string }>(
        `/api/v1/archivos/${archivo.idArchivo}/descarga`,
      );
      window.open(url, '_blank');
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  async desactivar(archivo: Archivo): Promise<void> {
    try {
      await this.api.post(`/api/v1/archivos/${archivo.idArchivo}/desactivar`, {});
      this.toast.ok(`"${archivo.nombreOriginal}" desactivado (el histórico se conserva).`);
      await this.cargar(this.referencia(), this.id());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  formatoBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const unidades = ['B', 'KB', 'MB', 'GB'];
    const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
    return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${unidades[exp]}`;
  }

  private async cargar(referencia: string, id: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.archivos.set(await this.api.get<Archivo[]>(`/api/v1/archivos/de/${referencia}/${id}`));
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
