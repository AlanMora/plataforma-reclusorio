import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { SelectBuscableComponent, aOpciones } from '../../shared/select-buscable.component';
import { ElementoPickerComponent, nombreElemento } from '../../shared/elemento-picker.component';
import { ElementoCardComponent } from '../../shared/elemento-card.component';
import { PermisoDirective } from '../../core/permiso.directive';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { Elemento, Incidencia, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import {
  fechaParaApi,
  presentarErrorFormulario,
  validarFormulario,
} from '../../core/validacion-formulario';
import { IconoComponent } from '../../shared/icono.component';

/** Alta de incidencia (RF-INC-001/002/006/007): válida sin personas. */
@Component({
  selector: 'rw-incidencia-nueva',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    SelectorFechaComponent,
    SelectBuscableComponent,
    ElementoPickerComponent,
    ElementoCardComponent,
    IconoComponent,
    PermisoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './incidencia-nueva.component.html',
})
export class IncidenciaNuevaComponent implements OnInit {
  /** Adapta valores de catálogo a opciones del select buscable. */
  readonly aOpciones = aOpciones;

  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly enModal = input(false);
  readonly idFormulario = input('formulario-incidencia');
  readonly mostrarAcciones = input(true);
  readonly guardada = output<Incidencia>();

  readonly centros = signal<ValorCatalogo[]>([]);
  readonly tipos = signal<ValorCatalogo[]>([]);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  /** Elementos elegidos durante la captura; se asocian al crear (RF-INC-005/007). */
  readonly elementosCaptura = signal<{ elemento: Elemento; primerRespondiente: boolean }[]>([]);

  marcarPrimerRespondiente = false;

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
    void this.catalogos
      .valores('centros')
      .then((v) => this.centros.set(v))
      .catch(() => undefined);
    void this.catalogos
      .valores('tipo_incidencia')
      .then((v) => this.tipos.set(v))
      .catch(() => undefined);
  }

  agregarElementoCaptura(elemento: Elemento): void {
    if (this.elementosCaptura().some((e) => e.elemento.idElemento === elemento.idElemento)) {
      this.toast.error('Ese elemento ya está en la lista de la captura.');
      return;
    }
    this.elementosCaptura.update((lista) => [
      ...lista,
      { elemento, primerRespondiente: this.marcarPrimerRespondiente },
    ]);
    this.marcarPrimerRespondiente = false;
  }

  quitarElementoCaptura(idElemento: string): void {
    this.elementosCaptura.update((lista) =>
      lista.filter((e) => e.elemento.idElemento !== idElemento),
    );
  }

  /** Asocia lo elegido a la incidencia recién creada; un fallo no revierte la captura. */
  private async asociarElementosCaptura(idIncidencia: string): Promise<void> {
    for (const { elemento, primerRespondiente } of this.elementosCaptura()) {
      try {
        await this.api.post(`/api/v1/incidencias/${idIncidencia}/elementos`, {
          idElemento: elemento.idElemento,
          primerRespondiente: primerRespondiente || undefined,
        });
      } catch (err) {
        this.toast.error(
          `La incidencia se guardó, pero "${nombreElemento(elemento)}" no se pudo asociar: ${mensajeDe(err)}`,
        );
      }
    }
    this.elementosCaptura.set([]);
  }

  async crear(formulario: NgForm, evento: SubmitEvent): Promise<void> {
    const errorValidacion = validarFormulario(formulario, evento);
    if (errorValidacion) {
      this.error.set(null);
      this.toast.error(errorValidacion);
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const incidencia = await this.api.post<Incidencia>('/api/v1/incidencias', {
        ...this.forma,
        fecha: fechaParaApi(this.forma['fecha']),
      });
      await this.asociarElementosCaptura(incidencia.idIncidencia);
      this.toast.ok('Incidencia registrada.');
      if (this.enModal()) this.guardada.emit(incidencia);
      else await this.router.navigate(['/incidencias', incidencia.idIncidencia]);
    } catch (err) {
      this.toast.error(presentarErrorFormulario(formulario, evento, err));
    } finally {
      this.guardando.set(false);
    }
  }
}
