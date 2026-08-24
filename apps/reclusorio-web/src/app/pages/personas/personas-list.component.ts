import {
  computed,
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { PaginadorComponent } from '../../shared/paginador.component';
import { Paginado, Persona } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { ModalFormulario } from '../../shared/modal-formulario/modal-formulario';
import { PersonaFormComponent } from './persona-form.component';
import { IconoComponent } from '../../shared/icono.component';

export function nombreCompleto(p: Persona): string {
  return [p.primerNombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ') || '—';
}

/** RF-PER-001/002: búsqueda por nombre, apellidos, alias y CURP; paginada. */
@Component({
  selector: 'rw-personas-list',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    PaginadorComponent,
    PermisoDirective,
    ModalFormulario,
    PersonaFormComponent,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './personas-list.component.html',
})
export class PersonasListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly pagina = signal<Paginado<Persona>>({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });

  /** Filas fantasma para que la tabla SIEMPRE mida 10 filas por página. */
  readonly relleno = computed(() =>
    Array.from({ length: Math.max(0, 10 - this.pagina().items.length) }),
  );
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarAlta = signal(false);
  textoBusqueda = '';
  curpBusqueda = '';

  nombreDe = nombreCompleto;

  ngOnInit(): void {
    void this.cargar(1);
  }

  buscar(): void {
    void this.cargar(1);
  }

  irAPagina(pagina: number): void {
    void this.cargar(pagina);
  }

  get hayFiltros(): boolean {
    return Boolean(this.textoBusqueda.trim() || this.curpBusqueda.trim());
  }

  limpiarFiltros(): void {
    this.textoBusqueda = '';
    this.curpBusqueda = '';
    void this.cargar(1);
  }

  alGuardar(persona: Persona): void {
    this.mostrarAlta.set(false);
    void this.router.navigate(['/personas', persona.idPersona]);
  }

  private async cargar(page: number): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.pagina.set(
        await this.api.get<Paginado<Persona>>('/api/v1/personas', {
          buscar: this.textoBusqueda.trim() || undefined,
          curp: this.curpBusqueda.trim() || undefined,
          page,
          limit: 10,
        }),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
