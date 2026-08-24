import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { PermisoDirective } from '../core/permiso.directive';
import { Archivo } from '../core/models';
import { mensajeDe } from '../core/problem';
import { VistaPreviaComponent, tipoVistaPrevia } from './vista-previa.component';
import { ArchivoMiniaturaComponent } from './archivo-miniatura.component';
import { IconoComponent } from './icono.component';

type ArchivoBiblioteca = Archivo & { origen: string };

const GRUPOS: Array<{ clave: string; etiqueta: string }> = [
  { clave: 'persona', etiqueta: 'Del expediente de la persona' },
  { clave: 'ingresos', etiqueta: 'De ingresos / libertades' },
  { clave: 'movimientos', etiqueta: 'De movimientos' },
  { clave: 'audiencias', etiqueta: 'De audiencias' },
  { clave: 'traslados', etiqueta: 'De traslados' },
  { clave: 'incidencias', etiqueta: 'De incidencias' },
];

/**
 * Biblioteca del expediente (requerimiento 11/08/2026): despliega de forma
 * visual TODOS los archivos asociados a la persona — los propios y los de
 * sus actividades — organizados por origen, con vista previa universal,
 * descarga y carga de nuevos archivos del expediente.
 */
@Component({
  selector: 'rw-biblioteca-archivos',
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
  templateUrl: './biblioteca-archivos.component.html',
})
export class BibliotecaArchivosComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly idPersona = input.required<string>();

  readonly archivos = signal<ArchivoBiblioteca[]>([]);
  readonly cargando = signal(false);
  readonly subiendo = signal(false);
  readonly error = signal<string | null>(null);
  descripcion = '';
  seleccionado: File | null = null;

  readonly grupos = computed(() =>
    GRUPOS.map((g) => ({
      ...g,
      archivos: this.archivos().filter((a) => a.origen === g.clave),
    })).filter((g) => g.archivos.length > 0),
  );

  constructor() {
    effect(() => {
      const id = this.idPersona();
      if (id) void this.cargar(id);
    });
  }

  puedePrevisualizar(archivo: Archivo): boolean {
    return tipoVistaPrevia(archivo.mimeType) !== null;
  }

  formatoBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const unidades = ['B', 'KB', 'MB', 'GB'];
    const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
    return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${unidades[exp]}`;
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
      form.append('idPersona', this.idPersona());
      if (this.descripcion.trim()) form.append('descripcion', this.descripcion.trim());
      await this.api.postForm<Archivo>('/api/v1/archivos', form);
      this.toast.ok('Archivo subido y verificado (SHA-256).');
      this.seleccionado = null;
      this.descripcion = '';
      await this.cargar(this.idPersona());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.subiendo.set(false);
    }
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
      const { url } = await this.api.get<{ url: string }>(
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
      await this.cargar(this.idPersona());
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  private async cargar(idPersona: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.archivos.set(
        await this.api.get<ArchivoBiblioteca[]>(`/api/v1/archivos/biblioteca/${idPersona}`),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
