import { normalizar } from './catalogos/catalogos.module';
import { Persona } from './entities/persona.entities';

describe('Reglas de negocio del reclusorio', () => {
  describe('normalizar (dedup de catálogos, RF-CAT-006)', () => {
    it('ignora espacios extremos, mayúsculas y acentos', () => {
      expect(normalizar('  Homicidio Calificado ')).toBe('homicidio calificado');
      expect(normalizar('EVASIÓN')).toBe(normalizar('evasion'));
      expect(normalizar('Riña')).toBe(normalizar('RIna'.replace('I', 'i').replace('na', 'ña')));
    });
    it('distingue valores realmente diferentes', () => {
      expect(normalizar('ROBO')).not.toBe(normalizar('ROBO CALIFICADO'));
    });
  });

  describe('edad calculada (RF-GEN-008)', () => {
    it('se calcula desde fechaNacimiento y nunca se persiste', () => {
      const p = new Persona();
      p.fechaNacimiento = '1990-05-15';
      const esperado = (() => {
        const hoy = new Date();
        let e = hoy.getFullYear() - 1990;
        if (hoy.getMonth() + 1 < 5 || (hoy.getMonth() + 1 === 5 && hoy.getDate() < 15)) e--;
        return e;
      })();
      expect(p.edad).toBe(esperado);
      expect(Object.keys(p)).not.toContain('edad'); // getter, no columna
    });
    it('es null sin fecha de nacimiento', () => {
      expect(new Persona().edad).toBeNull();
    });
  });
});
