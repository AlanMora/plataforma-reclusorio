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
  templateUrl: './incidencia-nueva.component.html',
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
