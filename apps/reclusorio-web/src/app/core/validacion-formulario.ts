import { NgForm } from '@angular/forms';
import { mensajeDe, problemaDe } from './problem';

const ETIQUETAS: Readonly<Record<string, string>> = {
  apellidoPaterno: 'Apellido paterno',
  calle: 'Calle',
  confirmPassword: 'Confirmación de contraseña',
  currentPassword: 'Contraseña actual',
  curp: 'CURP',
  descripcion: 'Descripción',
  desde: 'Desde',
  email: 'Correo electrónico',
  fecha: 'Fecha y hora',
  fechaNacimiento: 'Fecha de nacimiento',
  fechaSiguienteAudiencia: 'Fecha de la siguiente audiencia',
  idCentroDestino: 'Centro de destino',
  idCentroOrigen: 'Centro de origen',
  idCentroPenitenciario: 'Centro penitenciario',
  idDestinoTraslado: 'Destino',
  idEstatusTraslado: 'Estatus',
  idFormaIngresoAudiencia: 'Forma de ingreso',
  idJuezJuzgado: 'Juez del juzgado',
  idJuzgado: 'Juzgado',
  idModalidadAudiencia: 'Modalidad',
  idMotivoMovimiento: 'Motivo del movimiento',
  idProximaAudiencia: 'Próxima audiencia',
  idTipoAudiencia: 'Tipo de audiencia',
  idTipoIncidencia: 'Tipo de incidencia',
  idTipoIngresoEgreso: 'Tipo de ingreso o libertad',
  idTipoMovimiento: 'Tipo de movimiento',
  idTipoTraslado: 'Tipo de traslado',
  hasta: 'Hasta',
  nombre: 'Nombre',
  newPassword: 'Nueva contraseña',
  password: 'Contraseña',
  passwordActual: 'Contraseña actual',
  passwordConfirmacion: 'Confirmación de contraseña',
  passwordNueva: 'Nueva contraseña',
  primerNombre: 'Nombre',
};

/**
 * Valida los controles registrados en un NgForm y devuelve mensajes concretos.
 * También desplaza el formulario al primer campo incorrecto.
 */
export function validarFormulario(formulario: NgForm, evento: SubmitEvent): string | null {
  const invalidosAnidados = controlesInvalidosAnidados(formulario, evento);
  if (formulario.valid && invalidosAnidados.length === 0) return null;

  formulario.control.markAllAsTouched();
  enfocarPrimerInvalido(evento);

  const mensajes: string[] = [];
  const nombresProcesados = new Set<string>();
  for (const [nombre, control] of Object.entries(formulario.controls)) {
    if (!control.errors) continue;
    nombresProcesados.add(nombre);
    const etiqueta = etiquetaDe(nombre);
    if (control.errors['required']) mensajes.push(`${etiqueta} es obligatorio.`);
    else if (control.errors['email'])
      mensajes.push(`${etiqueta} debe ser un correo electrónico válido.`);
    else if (control.errors['minlength'])
      mensajes.push(
        `${etiqueta} debe tener al menos ${control.errors['minlength'].requiredLength} caracteres.`,
      );
    else if (control.errors['maxlength'])
      mensajes.push(
        `${etiqueta} debe tener como máximo ${control.errors['maxlength'].requiredLength} caracteres.`,
      );
    else if (control.errors['pattern']) mensajes.push(`${etiqueta} no tiene el formato requerido.`);
    else mensajes.push(`Revisa el campo ${etiqueta}.`);
  }

  // Los controles de componentes visuales anidados pueden quedar fuera del
  // árbol del NgForm padre aunque estén dentro de su elemento <form>.
  for (const control of invalidosAnidados) {
    const nombre = control.getAttribute('name');
    if (!nombre || nombresProcesados.has(nombre)) continue;
    nombresProcesados.add(nombre);
    const etiqueta = etiquetaDe(nombre);
    if (control.hasAttribute('required')) mensajes.push(`${etiqueta} es obligatorio.`);
    else if (control.getAttribute('type') === 'email')
      mensajes.push(`${etiqueta} debe ser un correo electrónico válido.`);
    else if (control.hasAttribute('minlength'))
      mensajes.push(
        `${etiqueta} debe tener al menos ${control.getAttribute('minlength')} caracteres.`,
      );
    else if (control.hasAttribute('maxlength'))
      mensajes.push(
        `${etiqueta} debe tener como máximo ${control.getAttribute('maxlength')} caracteres.`,
      );
    else if (control.hasAttribute('pattern'))
      mensajes.push(`${etiqueta} no tiene el formato requerido.`);
    else mensajes.push(`Revisa el campo ${etiqueta}.`);
  }

  return mensajes.length > 0
    ? mensajes.join('\n')
    : 'Revisa los campos señalados antes de continuar.';
}

function controlesInvalidosAnidados(formulario: NgForm, evento: SubmitEvent): HTMLElement[] {
  const elemento = evento.target;
  if (!(elemento instanceof HTMLFormElement)) return [];

  return [...elemento.querySelectorAll<HTMLElement>('[name].ng-invalid:not(form)')].filter(
    (control) => {
      const nombre = control.getAttribute('name');
      return !!nombre && !formulario.controls[nombre];
    },
  );
}

/** Asocia `errors[]` del Problem Details del backend con los controles del formulario. */
export function presentarErrorFormulario(
  formulario: NgForm,
  evento: SubmitEvent,
  error: unknown,
): string {
  const problema = problemaDe(error);
  const errores = Array.isArray(problema.errors)
    ? problema.errors.filter((mensaje): mensaje is string => typeof mensaje === 'string')
    : [];

  for (const mensaje of errores) {
    const campo = campoDeMensaje(mensaje);
    const control = campo ? formulario.controls[campo] : undefined;
    if (!control) continue;
    control.setErrors({ ...(control.errors ?? {}), servidor: mensaje });
    control.markAsTouched();
  }

  enfocarPrimerInvalido(evento);
  return errores.length > 0 ? errores.map(formatearMensaje).join('\n') : mensajeDe(error);
}

/**
 * Convierte una fecha válida al ISO esperado por la API. Si está vacía o es
 * inválida, evita lanzar una excepción local para que el backend responda con
 * su Problem Details específico.
 */
export function fechaParaApi(valor: string): string | undefined {
  const limpio = valor.trim();
  if (!limpio) return undefined;
  const fecha = new Date(limpio);
  return Number.isNaN(fecha.getTime()) ? limpio : fecha.toISOString();
}

function campoDeMensaje(mensaje: string): string | undefined {
  const coincidencia = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s/.exec(mensaje);
  return coincidencia?.[1].split('.').at(-1);
}

function formatearMensaje(mensaje: string): string {
  const campo = campoDeMensaje(mensaje);
  if (!campo) return mensaje;
  const etiqueta = ETIQUETAS[campo];
  return etiqueta ? mensaje.replace(campo, etiqueta) : mensaje;
}

function etiquetaDe(nombre: string): string {
  return (
    ETIQUETAS[nombre] ??
    nombre
      .replace(/^id/, '')
      .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
      .replace(/^./, (letra) => letra.toUpperCase())
  );
}

function enfocarPrimerInvalido(evento: SubmitEvent): void {
  const elemento = evento.target;
  if (!(elemento instanceof HTMLFormElement)) return;

  queueMicrotask(() => {
    const invalido = elemento.querySelector<HTMLElement>('.ng-invalid:not(form)');
    if (!invalido) return;
    invalido.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const control = invalido.matches('input, select, textarea, button')
      ? invalido
      : invalido.querySelector<HTMLElement>('input, select, textarea, button');
    control?.focus({ preventScroll: true });
  });
}
