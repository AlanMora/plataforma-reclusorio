import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { fabricaErroresValidacion, traducirMensajeValidacion } from './mensajes-validacion';

describe('traducirMensajeValidacion', () => {
  it('traduce los mensajes por defecto de class-validator', () => {
    const casos: Array<[string, string]> = [
      [
        'fechaNacimiento must be a valid ISO 8601 date string',
        'fechaNacimiento debe ser una fecha válida (formato AAAA-MM-DD)',
      ],
      ['curp must be longer than or equal to 18 characters', 'curp debe tener al menos 18 caracteres'],
      ['curp must be shorter than or equal to 18 characters', 'curp debe tener como máximo 18 caracteres'],
      ['curp must be a string', 'curp debe ser un texto'],
      ['idPersona must be a UUID', 'idPersona debe ser un identificador (UUID) válido'],
      ['primerNombre should not be empty', 'primerNombre no debe estar vacío'],
      ['activo must be a boolean value', 'activo debe ser verdadero o falso'],
      ['correo must be an email', 'correo debe ser un correo electrónico válido'],
      ['page must be an integer number', 'page debe ser un número entero'],
      ['page must not be less than 1', 'page no debe ser menor que 1'],
      ['limit must not be greater than 100', 'limit no debe ser mayor que 100'],
      ['curp must match /^[A-Z]{4}\\d{6}/ regular expression', 'curp no tiene el formato requerido'],
      ['tipo must be one of the following values: ALTA, BAJA', 'tipo debe ser uno de los siguientes valores: ALTA, BAJA'],
      ['domicilios must be an array', 'domicilios debe ser una lista'],
      ['property foo should not exist', 'la propiedad foo no está permitida'],
    ];
    for (const [ingles, esperado] of casos) {
      expect(traducirMensajeValidacion(ingles)).toBe(esperado);
    }
  });

  it('deja intactos los mensajes personalizados ya escritos en español', () => {
    const personalizado = 'curp no tiene el formato oficial de 18 caracteres';
    expect(traducirMensajeValidacion(personalizado)).toBe(personalizado);
  });
});

describe('fabricaErroresValidacion', () => {
  it('genera un BadRequestException con los mensajes traducidos', () => {
    const errores: ValidationError[] = [
      {
        property: 'curp',
        constraints: {
          isString: 'curp must be a string',
          minLength: 'curp must be longer than or equal to 18 characters',
        },
        children: [],
      },
    ];

    const excepcion = fabricaErroresValidacion(errores);
    expect(excepcion).toBeInstanceOf(BadRequestException);
    const cuerpo = excepcion.getResponse() as { message: string[] };
    expect(cuerpo.message).toEqual([
      'curp debe ser un texto',
      'curp debe tener al menos 18 caracteres',
    ]);
  });

  it('antepone la ruta del padre en DTOs anidados', () => {
    const errores: ValidationError[] = [
      {
        property: 'domicilio',
        children: [
          {
            property: 'calle',
            constraints: { isString: 'calle must be a string' },
            children: [],
          },
        ],
      },
    ];

    const cuerpo = fabricaErroresValidacion(errores).getResponse() as { message: string[] };
    expect(cuerpo.message).toEqual(['domicilio.calle debe ser un texto']);
  });
});
