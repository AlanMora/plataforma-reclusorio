import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Excepción base de dominio. Los servicios lanzan subclases de ésta para
 * representar errores de negocio con un `code` estable que el filtro global
 * traduce al sobre de respuesta uniforme.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export class EntityNotFoundException extends DomainException {
  constructor(entity: string, id?: string | number) {
    super(
      'ENTITY_NOT_FOUND',
      id ? `${entity} con id "${id}" no encontrado` : `${entity} no encontrado`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class BusinessRuleException extends DomainException {
  constructor(message: string, details?: unknown) {
    super('BUSINESS_RULE_VIOLATION', message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class UnauthorizedDomainException extends DomainException {
  constructor(message = 'No autorizado') {
    super('UNAUTHORIZED', message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenDomainException extends DomainException {
  constructor(message = 'Acceso denegado') {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}
