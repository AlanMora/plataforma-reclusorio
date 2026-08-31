/**
 * Edad calculada desde la fecha de nacimiento (RF-GEN-008: SIEMPRE calculada,
 * nunca persistida). Mismo algoritmo que el backend; se usa como respaldo de
 * presentación cuando la respuesta aún no trae `edad` y para mostrarla en
 * vivo durante la captura.
 */
export function calcularEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]) - 1;
  const dia = Number(m[3]);
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  const dm = hoy.getMonth() - mes;
  if (dm < 0 || (dm === 0 && hoy.getDate() < dia)) edad--;
  return Number.isFinite(edad) ? edad : null;
}
