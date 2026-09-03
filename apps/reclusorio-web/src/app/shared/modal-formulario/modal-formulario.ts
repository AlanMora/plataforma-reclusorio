import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import { IconoComponent } from '../icono.component';

let consecutivoModal = 0;

@Component({
  selector: 'rw-modal-formulario',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal-formulario.html',
  host: { class: 'contents' },
})
export class ModalFormulario implements OnDestroy {
  readonly titulo = input.required<string>();
  readonly etiqueta = input('Nuevo registro');
  readonly descripcion = input('');
  readonly bloquearCierre = input(false);
  /** true → altura mínima generosa para que desplegables y calendario quepan sin recortarse. */
  readonly amplio = input(false);
  readonly cerrar = output<void>();

  readonly idTitulo = `modal-formulario-titulo-${++consecutivoModal}`;
  readonly idDescripcion = `modal-formulario-descripcion-${consecutivoModal}`;

  private readonly documento = inject(DOCUMENT);
  private readonly dialogo = viewChild.required<ElementRef<HTMLElement>>('dialogo');
  private readonly focoAnterior = this.documento.activeElement as HTMLElement | null;
  private readonly overflowAnterior = this.documento.body.style.overflow;

  constructor() {
    this.documento.body.style.overflow = 'hidden';

    afterNextRender(() => {
      const dialogo = this.dialogo().nativeElement;
      const primerControl = dialogo.querySelector<HTMLElement>(
        '.modal-body input:not([disabled]), .modal-body select:not([disabled]), .modal-body textarea:not([disabled]), .modal-body button:not([disabled])',
      );
      (primerControl ?? dialogo).focus();
    });
  }

  ngOnDestroy(): void {
    this.documento.body.style.overflow = this.overflowAnterior;
    this.focoAnterior?.focus();
  }

  solicitarCierre(): void {
    if (!this.bloquearCierre()) this.cerrar.emit();
  }

  manejarTeclado(evento: KeyboardEvent): void {
    // Un control interno ya consumió la tecla (p. ej. Esc cerró su desplegable).
    if (evento.defaultPrevented) return;

    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.solicitarCierre();
      return;
    }

    if (evento.key !== 'Tab') return;

    const controles = Array.from(
      this.dialogo().nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((control) => control.getClientRects().length > 0);

    if (controles.length === 0) {
      evento.preventDefault();
      this.dialogo().nativeElement.focus();
      return;
    }

    const primero = controles[0];
    const ultimo = controles.at(-1);
    const activo = this.documento.activeElement;

    if (evento.shiftKey && activo === primero) {
      evento.preventDefault();
      ultimo?.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
}
