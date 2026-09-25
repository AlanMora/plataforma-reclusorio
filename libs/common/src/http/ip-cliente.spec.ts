import { ipCliente } from './ip-cliente';

describe('ipCliente', () => {
  it('prefiere X-Real-IP (lo fija nginx, el cliente no lo controla)', () => {
    expect(
      ipCliente({ ip: '10.0.0.5', headers: { 'x-real-ip': '201.1.2.3', 'x-forwarded-for': '6.6.6.6, 201.1.2.3, 10.0.0.2' } }),
    ).toBe('201.1.2.3');
  });

  it('sin X-Real-IP usa el ÚLTIMO salto de X-Forwarded-For, no el primero falsificable', () => {
    expect(ipCliente({ ip: '10.0.0.5', headers: { 'x-forwarded-for': '6.6.6.6, 192.168.1.20' } })).toBe('192.168.1.20');
  });

  it('sin cabeceras de proxy cae en req.ip', () => {
    expect(ipCliente({ ip: '::1', headers: {} })).toBe('::1');
  });
});
