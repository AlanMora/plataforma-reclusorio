import { Directive, inject, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Estructural: renderiza el bloque solo si el usuario tiene el permiso.
 * Uso: <button *rwPermiso="'personas:crear'">Nueva persona</button>
 */
@Directive({ selector: '[rwPermiso]', standalone: true })
export class PermisoDirective {
  private readonly plantilla = inject(TemplateRef<unknown>);
  private readonly contenedor = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);
  private visible = false;

  @Input() set rwPermiso(permiso: string) {
    const permitido = this.auth.tiene(permiso);
    if (permitido && !this.visible) {
      this.contenedor.createEmbeddedView(this.plantilla);
      this.visible = true;
    } else if (!permitido && this.visible) {
      this.contenedor.clear();
      this.visible = false;
    }
  }
}
