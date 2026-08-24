import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const origen = process.argv[2];
if (!origen) {
  console.error('Uso: pnpm mapbox:configure <archivo-con-token>');
  process.exit(1);
}

const contenido = await readFile(resolve(origen), 'utf8');
const coincidencia = contenido.match(
  /(?:MAPBOX_ACCESS_TOKEN\s*=|mapboxAccessToken\s*:)\s*['"]?([^'"\s,;}]+)/,
);
const token = coincidencia?.[1]?.trim();

if (!token?.startsWith('pk.')) {
  console.error('No se encontro un token publico de Mapbox (pk.*) en el archivo indicado.');
  process.exit(1);
}

const destino = resolve('public/mapbox-config.js');
const configuracion = `window.__RECLUSORIO_CONFIG__ = ${JSON.stringify({ mapboxAccessToken: token })};\n`;
await writeFile(destino, configuracion, { mode: 0o600 });
console.log('Configuracion local de Mapbox creada sin exponer el token.');
