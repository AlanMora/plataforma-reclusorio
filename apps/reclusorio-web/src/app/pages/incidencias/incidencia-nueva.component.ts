import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { Incidencia, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/** Alta de incidencia (RF-INC-001/002/006/007): válida sin personas. */
@Component({
  selector: 'rw-incidencia-nueva',
  standalone: true,
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl space-y-5">
      <div>
        <a routerLink="/incidencias" class="etiqueta hover:text-neon">← Incidencias</a>
        <h2 class="mt-1 text-2xl font-bold text-slate-100">Registrar incidencia</h2>
        <p class="mt-1 text-sm text-slate-500">
          Las asociaciones (personas, autoridades, elementos) se agregan después, desde el detalle.
        </p>
      </div>

      <form class="panel grid gap-4 p-6 md:grid-cols-2" (ngSubmit)="crear()">
        <div>
          <label class="campo-etiqueta obligatorio" for="incCentro">Centro penitenciario</label>
          <select class="campo" id="incCentro" name="idCentroPenitenciario" required [(ngModel)]="forma.idCentroPenitenciario">
            <option value="" disabled>Selecciona…</option>
            @for (v of centros(); track v.id) {
              <option [value]="v.id">{{ v.nombre }}</option>
            }
          </select>
        </div>
        <div>
          <label class="campo-etiqueta obligatorio" for="incTipo">Tipo de incidencia</label>
          <select class="campo" id="incTipo" name="idTipoIncidencia" required [(ngModel)]="forma.idTipoIncidencia">
            <option value="" disabled>Selecciona…</option>
            @for (v of tipos(); track v.id) {
              <option [value]="v.id">{{ v.nombre }}</option>
            }
          </select>
        </div>
        <div>
          <label class="campo-etiqueta obligatorio" for="incFecha">Fecha y hora</label>
          <input class="campo" id="incFecha" name="fecha" type="datetime-local" required [(ngModel)]="forma.fecha" />
        </div>
        <div>
          <label class="campo-etiqueta" for="incIph">IPH</label>
          <input class="campo font-mono" id="incIph" name="iph" maxlength="100" [(ngModel)]="forma.iph" />
        </div>
        <div class="md:col-span-2">
          <label class="campo-etiqueta obligatorio" for="incDescripcion">Descripción</label>
          <textarea class="campo" id="incDescripcion" name="descripcion" rows="3" maxlength="2000" required [(ngModel)]="forma.descripcion"></textarea>
        </div>
        <div>
          <label class="campo-etiqueta" for="incPrimerRespondiente">Primer respondiente (texto libre)</label>
          <input class="campo" id="incPrimerRespondiente" name="primerRespondiente" maxlength="255" [(ngModel)]="forma.primerRespondiente" />
          <p class="mt-1 text-[11px] text-slate-600">
            Úsalo cuando el elemento NO está en el padrón (RF-INC-007); si está registrado, asócialo en el detalle.
          </p>
        </div>
        <div class="md:col-span-2">
          <label class="campo-etiqueta" for="incNarrativa">Narrativa</label>
          <textarea class="campo" id="incNarrativa" name="narrativa" rows="4" [(ngModel)]="forma.narrativa"></textarea>
        </div>
        @if (error()) {
          <p class="alerta-error md:col-span-2">{{ error() }}</p>
        }
        <div class="flex justify-end md:col-span-2">
          <button class="btn-primario" type="submit" [disabled]="guardando()">
            {{ guardando() ? 'Guardando…' : 'Registrar incidencia' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class IncidenciaNuevaComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly centros = signal<ValorCatalogo[]>([]);
  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  forma: Record<string, string> = {
    idCentroPenitenciario: '',
    idTipoIncidencia: '',
    fecha: '',
    descripcion: '',
    iph: '',
    primerRespondiente: '',
    narrativa: '',
  };

  ngOnInit(): void {
    void this.catalogos.valores('centros').then((v) => this.centros.set(v)).catch(() => undefined);
    void this.catalogos.valores('tipo_incidencia').then((v) => this.tipos.set(v)).catch(() => undefined);
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    this.error.set(null);
    try {
      const incidencia = await this.api.post<Incidencia>('/api/v1/incidencias', {
        ...this.forma,
        fecha: new Date(this.forma['fecha']).toISOString(),
      });
      this.toast.ok('Incidencia registrada.');
      await this.router.navigate(['/incidencias', incidencia.idIncidencia]);
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }
}
