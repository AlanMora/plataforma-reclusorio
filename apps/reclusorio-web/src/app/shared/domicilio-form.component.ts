import { ChangeDetectionStrategy, Component, OnInit, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Domicilio } from '../core/models';
import {
  PAISES_DUMMY,
  canonizarUbicacion,
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
 * al momento de guardar (alta de persona, alta o edición de domicilio en el
 * detalle; en edición se precarga vía `inicial`/`cargar`).
 */
@Component({
  selector: 'rw-domicilio-form',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MapaDomicilioComponent, SelectBuscableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './domicilio-form.component.html',
})
export class DomicilioFormComponent implements OnInit {
  /** Domicilio existente para precargar el formulario (modo edición). */
  readonly inicial = input<Domicilio | null>(null);

  domicilio = nuevoDomicilio();

  readonly paises = PAISES_DUMMY.map((p) => p.nombre);

  ngOnInit(): void {
    const valores = this.inicial();
    if (valores) this.cargar(valores);
  }

  /** true si hay algo que guardar (la calle es el campo obligatorio). */
  capturado(): boolean {
    return this.domicilio.calle.trim().length > 0;
  }

  reiniciar(): void {
    this.domicilio = nuevoDomicilio();
  }

  /**
   * Rellena el modelo desde un domicilio ya guardado (modo edición). País,
   * estado y municipio se canonizan contra el catálogo para que registros
   * previos ("estado de Jalisco", "JALISCO", "Jal.") caigan en la opción real
   * del select y se guarden ya normalizados al editar.
   */
  cargar(valores: Domicilio): void {
    const ubicacion = canonizarUbicacion({
      pais: valores.pais ?? '',
      estado: valores.estado ?? '',
      municipio: valores.municipio ?? '',
    });
    this.domicilio = {
      calle: valores.calle ?? '',
      numeroExterior: valores.numeroExterior ?? '',
      numeroInterior: valores.numeroInterior ?? '',
      cruce1: valores.cruce1 ?? '',
      cruce2: valores.cruce2 ?? '',
      colonia: valores.colonia ?? '',
      ...ubicacion,
      latitud: valores.latitud ?? null,
      longitud: valores.longitud ?? null,
    };
  }

  /**
   * Dirección legible del domicilio cargado, para precargar el buscador del
   * mapa en modo edición ("Calle 123, Colonia, Municipio, Estado, País").
   */
  direccionInicial(): string {
    const valores = this.inicial();
    if (!valores) return '';
    const calleYNumero = [valores.calle, valores.numeroExterior]
      .map((v) => (v ?? '').trim())
      .filter(Boolean)
      .join(' ');
    const { pais, estado, municipio } = canonizarUbicacion({
      pais: valores.pais ?? '',
      estado: valores.estado ?? '',
      municipio: valores.municipio ?? '',
    });
    return [calleYNumero, valores.colonia, municipio, estado, pais]
      .map((v) => (v ?? '').trim())
      .filter(Boolean)
      .join(', ');
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

  /**
   * El mapa geocodificó una dirección: llena los campos y guarda lat/lon.
   * País/estado/municipio se canonizan en cascada ("Estado de Jalisco" →
   * "Jalisco") para que coincidan con las opciones reales de los selects.
   */
  alUbicar(dom: DomicilioGeocodificado): void {
    const d = this.domicilio;
    if (dom.calle) d.calle = dom.calle;
    if (dom.numeroExterior) d.numeroExterior = dom.numeroExterior;
    if (dom.colonia) d.colonia = dom.colonia;
    const ubicacion = canonizarUbicacion({
      pais: dom.pais || d.pais,
      estado: dom.estado || d.estado,
      municipio: dom.municipio || d.municipio,
    });
    if (dom.pais) d.pais = ubicacion.pais;
    if (dom.estado) d.estado = ubicacion.estado;
    if (dom.municipio) d.municipio = ubicacion.municipio;
    d.latitud = dom.latitud;
    d.longitud = dom.longitud;
  }
}
