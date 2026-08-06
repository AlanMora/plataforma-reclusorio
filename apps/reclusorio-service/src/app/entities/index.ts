export * from './catalogos-administrables.entities';
export * from './catalogos-fijos.entities';
export * from './persona.entities';
export * from './actividades.entities';
export * from './incidencia.entities';
export * from './archivo.entity';

import { CATALOGOS_ADMINISTRABLES } from './catalogos-administrables.entities';
import { CATALOGOS_FIJOS } from './catalogos-fijos.entities';
import { Domicilio, Elemento, Persona } from './persona.entities';
import {
  Audiencia,
  AudienciaElemento,
  IngresoEgreso,
  Movimiento,
  Traslado,
  TrasladoElemento,
} from './actividades.entities';
import {
  Incidencia,
  IncidenciaAutoridad,
  IncidenciaElemento,
  IncidenciaPersona,
} from './incidencia.entities';
import { Archivo } from './archivo.entity';

/** Todas las entidades del dominio del reclusorio (Modelo de Datos Consolidado). */
export const ENTIDADES_RECLUSORIO = [
  ...CATALOGOS_ADMINISTRABLES,
  ...CATALOGOS_FIJOS,
  Persona,
  Domicilio,
  Elemento,
  IngresoEgreso,
  Movimiento,
  Audiencia,
  Traslado,
  AudienciaElemento,
  TrasladoElemento,
  Incidencia,
  IncidenciaPersona,
  IncidenciaAutoridad,
  IncidenciaElemento,
  Archivo,
];
