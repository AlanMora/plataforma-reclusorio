import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { ReferenciaArchivo } from '../core/models';
import { mensajeDe } from '../core/problem';
import { IconoComponent } from './icono.component';

/** Archivo elegido durante una captura, con su descripción opcional. */
interface ArchivoCaptura {
  archivo: File;
  descripcion: string;
}

/**
 * Selección de archivos DURANTE la captura de un registro (carga integrada):
 * permite elegir varios archivos y capturar la descripción de cada uno ANTES
 * de guardar. El contenedor llama a `subirA(referencia, id)` con el registro
 * recién creado; un fallo de subida no revierte la captura (se avisa por toast).
 */
@Component({
  selector: 'rw-archivos-captura',
  standalone: true,
  imports: [FormsModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2">
      <input
        #entrada
        class="campo max-w-md text-xs file:mr-3 file:rounded file:border-0 file:bg-neon/10 file:px-2 file:py-1 file:text-neon"
        type="file"
        [id]="idCampo()"
        multiple
        (change)="agregar(entrada)"
      />
      @for (fila of seleccionados(); track fila; let i = $index) {
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="max-w-[220px] truncate font-mono text-[11px] text-slate-400"
            [title]="fila.archivo.name"
          >
            {{ fila.archivo.name }}
          </span>
          <input
            class="campo grow min-w-[180px] text-xs"
            [name]="'descripcionArchivoCaptura' + i"
            maxlength="500"
            placeholder="Descripción (opcional)"
            [(ngModel)]="fila.descripcion"
          />
          <button
            class="btn-secundario btn-mini shrink-0"
            type="button"
            (click)="quitar(fila)"
            title="Quitar archivo"
          >
            <rw-icono nombre="cerrar" [tamano]="12" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ArchivosCapturaComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  /** id del input de archivos, para asociarlo con el label del formulario. */
  readonly idCampo = input('archivos-captura');

  readonly seleccionados = signal<ArchivoCaptura[]>([]);

  agregar(entrada: HTMLInputElement): void {
    const nuevos = Array.from(entrada.files ?? []).map((archivo) => ({
      archivo,
      descripcion: '',
    }));
    this.seleccionados.update((lista) => [...lista, ...nuevos]);
    entrada.value = ''; // permite volver a elegir (incluso el mismo archivo)
  }

  quitar(fila: ArchivoCaptura): void {
    this.seleccionados.update((lista) => lista.filter((f) => f !== fila));
  }

  limpiar(): void {
    this.seleccionados.set([]);
  }

  /** Sube lo elegido al registro recién creado; un fallo no revierte la captura. */
  async subirA(referencia: ReferenciaArchivo, id: string): Promise<void> {
    for (const { archivo, descripcion } of this.seleccionados()) {
      const form = new FormData();
      form.append('file', archivo);
      form.append(referencia, id);
      if (descripcion.trim()) form.append('descripcion', descripcion.trim());
      try {
        await this.api.postForm('/api/v1/archivos', form);
      } catch (err) {
        this.toast.error(
          `El registro se guardó, pero "${archivo.name}" no se pudo subir: ${mensajeDe(err)}`,
        );
      }
    }
    this.limpiar();
  }
}
