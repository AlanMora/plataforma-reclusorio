import { parseBoolean, parseNumber, validateEnv } from './env.validation';

describe('env helpers', () => {
  it('parseNumber usa el valor o el fallback', () => {
    expect(parseNumber('5', 1)).toBe(5);
    expect(parseNumber(undefined, 7)).toBe(7);
    expect(parseNumber('no-num', 7)).toBe(7);
  });

  it('parseBoolean interpreta valores comunes', () => {
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('1')).toBe(true);
    expect(parseBoolean('0')).toBe(false);
    expect(parseBoolean(undefined, true)).toBe(true);
  });

  it('validateEnv exige JWT_SECRET en producción', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow();
    expect(validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'x' })).toBeDefined();
    expect(validateEnv({ NODE_ENV: 'development' })).toBeDefined();
  });
});
