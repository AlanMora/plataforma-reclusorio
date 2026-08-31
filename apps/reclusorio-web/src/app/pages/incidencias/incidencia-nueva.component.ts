import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { SelectorFechaComponent } from '../../shared/selector-fecha.component';
import { SelectBuscableComponent, aOpciones } from '../../shared/select-buscable.component';
import { ElementoPickerComponent, nombreElemento } from '../../shared/elemento-picker.component';
import { ElementoCardComponent } from '../../shared/elemento-card.component';
import { ArchivosCapturaComponent } from '../../shared/archivos-captura.component';
import { PermisoDirective } from '../../core/permiso.directive';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ToastService } from '../../core/toast.service';
import { Elemento, Incidencia, Paginado, Persona, ValorCatalogo } from '../../core/models';
import { nombreCompleto } from '../personas/personas-list.component';
import { mensajeDe } from '../../core/problem';
import {
  fechaParaApi,
  presentarErrorFormulario,
  validarFormulario,
} from '../../core/validacion-formulario';
import { IconoComponent } from '../../shared/icono.component';

/**
 * Alta de incidencia (RF-INC-001/002/006/007): válida sin personas. Personas,
 * autoridades de apoyo, elementos y archivos pueden capturarse AQUÍ MISMO;
 * se asocian/suben en cuanto se crea el registro.
 */
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
    ArchivosCapturaComponent,
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
  readonly autoridades = signal<ValorCatalogo[]>([]);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  /** Elementos elegidos durante la captura; se asocian al crear (RF-INC-005/007). */
  readonly elementosCaptura = signal<{ elemento: Elemento; primerRespondiente: boolean }[]>([]);
  /** Personas elegidas durante la captura; se asocian al crear (RF-INC-003). */
  readonly personasCaptura = signal<Persona[]>([]);
  readonly candidatasPersonas = signal<Persona[]>([]);
  /** Autoridades de apoyo elegidas durante la captura (RF-INC-004). */
  readonly autoridadesCaptura = signal<ValorCatalogo[]>([]);

  /** Archivos elegidos durante la captura; se suben al crear (RF-INC-009). */
  private readonly archivosCaptura = viewChild<ArchivosCapturaComponent>('archivosCaptura');

  marcarPrimerRespondiente = false;
  textoPersona = '';
  autoridadSeleccionada = '';

  nombreDePersona = nombreCompleto;

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
    void this.catalogos
      .valores('autoridad')
      .then((v) => this.autoridades.set(v))
      .catch(() => undefined);
  }

  /** Busca personas por nombre/alias o CURP exacta para asociarlas en la captura. */
  async buscarPersonas(): Promise<void> {
    const texto = this.textoPersona.trim();
    if (!texto) return;
    try {
      const esCurp = /^[A-Z0-9]{18}$/i.test(texto);
      const pagina = await this.api.get<Paginado<Persona>>('/api/v1/personas', {
        buscar: esCurp ? undefined : texto,
        curp: esCurp ? texto : undefined,
        page: 1,
        limit: 5,
      });
      this.candidatasPersonas.set(pagina.items);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  agregarPersonaCaptura(p: Persona): void {
    if (this.personasCaptura().some((x) => x.idPersona === p.idPersona)) {
      this.toast.error('Esa persona ya está en la lista de la captura.');
      return;
    }
    this.personasCaptura.update((lista) => [...lista, p]);
    this.candidatasPersonas.set([]);
    this.textoPersona = '';
  }

  quitarPersonaCaptura(idPersona: string): void {
    this.personasCaptura.update((lista) => lista.filter((p) => p.idPersona !== idPersona));
  }

  agregarAutoridadCaptura(): void {
    const elegida = this.autoridades().find((a) => a.id === this.autoridadSeleccionada);
    if (!elegida) return;
    if (this.autoridadesCaptura().some((a) => a.id === elegida.id)) {
      this.toast.error('Esa autoridad ya está en la lista de la captura.');
      return;
    }
    this.autoridadesCaptura.update((lista) => [...lista, elegida]);
    this.autoridadSeleccionada = '';
  }

  quitarAutoridadCaptura(id: string): void {
    this.autoridadesCaptura.update((lista) => lista.filter((a) => a.id !== id));
  }

  /** Asocia personas y autoridades elegidas; un fallo no revierte la captura. */
  private async asociarPersonasYAutoridades(idIncidencia: string): Promise<void> {
    for (const p of this.personasCaptura()) {
      try {
        await this.api.post(`/api/v1/incidencias/${idIncidencia}/personas`, {
          idPersona: p.idPersona,
        });
      } catch (err) {
        this.toast.error(
          `La incidencia se guardó, pero "${nombreCompleto(p)}" no se pudo asociar: ${mensajeDe(err)}`,
        );
      }
    }
    this.personasCaptura.set([]);
    for (const a of this.autoridadesCaptura()) {
      try {
        await this.api.post(`/api/v1/incidencias/${idIncidencia}/autoridades`, {
          idAutoridad: a.id,
        });
      } catch (err) {
        this.toast.error(
          `La incidencia se guardó, pero la autoridad "${a.nombre}" no se pudo asociar: ${mensajeDe(err)}`,
        );
      }
    }
    this.autoridadesCaptura.set([]);
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
      await this.asociarPersonasYAutoridades(incidencia.idIncidencia);
      await this.archivosCaptura()?.subirA('idIncidencia', incidencia.idIncidencia);
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
