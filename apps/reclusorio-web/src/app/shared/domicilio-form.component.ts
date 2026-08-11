import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PAISES_DUMMY,
  canonizar,
  conValorActual,
  estadosDe,
  municipiosDe,
} from '../core/ubicaciones-dummy';
import { DomicilioGeocodificado, MapaDomicilioComponent } from './mapa-domicilio.component';
import { SelectBuscableComponent } from './select-buscable.component';

/** Modelo editable del domicilio; lat/lon se fijan desde el mapa. */
export function nuevoDomicilio() {
  return {
    calle: '',
    numeroExterior: '',
    numeroInterior: '',
    cruce1: '',
    cruce2: '',
    colonia: '',
    municipio: '',
    estado: '',
    pais: '',
    latitud: null as number | null,
    longitud: null as number | null,
  };
}

/**
 * Captura de domicilio reutilizable (RF-PER-006/007): mapa con buscador de
 * dirección (autollenado + coordenadas), selects en cascada de país/estado/
 * municipio y campos del modelo. NO envía nada: el contenedor lee `domicilio`
 * al momento de guardar (alta de persona o alta de domicilio en el detalle).
 */
@Component({
  selector: 'rw-domicilio-form',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MapaDomicilioComponent, SelectBuscableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './domicilio-form.component.html',
})
export class DomicilioFormComponent {
  domicilio = nuevoDomicilio();

  readonly paises = PAISES_DUMMY.map((p) => p.nombre);

  /** true si hay algo que guardar (la calle es el campo obligatorio). */
  capturado(): boolean {
    return this.domicilio.calle.trim().length > 0;
  }

  reiniciar(): void {
    this.domicilio = nuevoDomicilio();
  }

  paisesOpciones(): string[] {
    return conValorActual(this.paises, this.domicilio.pais);
  }

  estadosOpciones(): string[] {
    return conValorActual(
      estadosDe(this.domicilio.pais).map((e) => e.nombre),
      this.domicilio.estado,
    );
  }

  municipiosOpciones(): string[] {
    return conValorActual(
      municipiosDe(this.domicilio.pais, this.domicilio.estado),
      this.domicilio.municipio,
    );
  }

  alCambiarPais(): void {
    this.domicilio.estado = '';
    this.domicilio.municipio = '';
  }

  alCambiarEstado(): void {
    this.domicilio.municipio = '';
  }

  /** El mapa geocodificó una dirección: llena los campos y guarda lat/lon. */
  alUbicar(dom: DomicilioGeocodificado): void {
    const d = this.domicilio;
    if (dom.calle) d.calle = dom.calle;
    if (dom.numeroExterior) d.numeroExterior = dom.numeroExterior;
    if (dom.colonia) d.colonia = dom.colonia;
    if (dom.pais) d.pais = canonizar(dom.pais, this.paises);
    if (dom.estado)
      d.estado = canonizar(
        dom.estado,
        estadosDe(d.pais).map((e) => e.nombre),
      );
    if (dom.municipio) d.municipio = canonizar(dom.municipio, municipiosDe(d.pais, d.estado));
    d.latitud = dom.latitud;
    d.longitud = dom.longitud;
  }
}
