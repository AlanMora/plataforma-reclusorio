import { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { BusinessRuleException } from '../exceptions/domain.exception';

function mockHost(request: Record<string, unknown>) {
  const res = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('AllExceptionsFilter (RFC 9457)', () => {
  const filter = new AllExceptionsFilter();

  it('emite application/problem+json para una excepción de dominio', () => {
    const { host, res } = mockHost({ method: 'POST', url: '/api/v1/x', originalUrl: '/api/v1/x' });
    filter.catch(new BusinessRuleException('regla violada'), host);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.type).toHaveBeenCalledWith('application/problem+json');
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe(422);
    expect(body.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(body.detail).toBe('regla violada');
    expect(body.instance).toBe('/api/v1/x');
  });

  it('mapea un error genérico a 500 INTERNAL_ERROR', () => {
    const { host, res } = mockHost({ method: 'GET', url: '/x' });
    filter.catch(new Error('boom'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.status).toBe(500);
  });
});
