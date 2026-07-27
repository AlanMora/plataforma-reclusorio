#!/usr/bin/env node
/**
 * Renombra core-domain-service al nombre del proyecto.
 *
 *   pnpm rename:core <nuevo-nombre>   # p.ej. pnpm rename:core loans-service
 *
 * Actualiza el directorio de la app, project.json, output de webpack y las
 * referencias en .env.example. Revisa el diff resultante antes de commitear.
 */
import { readdirSync, readFileSync, renameSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OLD = 'core-domain-service';
const target = process.argv[2];

if (!target || !/^[a-z][a-z0-9-]*$/.test(target)) {
  console.error('Uso: pnpm rename:core <nuevo-nombre>  (kebab-case, p.ej. loans-service)');
  process.exit(1);
}

const oldDir = join(ROOT, 'apps', OLD);
const newDir = join(ROOT, 'apps', target);

if (!existsSync(oldDir)) {
  console.error(`No existe apps/${OLD}. ¿Ya fue renombrado?`);
  process.exit(1);
}
if (existsSync(newDir)) {
  console.error(`Ya existe apps/${target}.`);
  process.exit(1);
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|js|json)$/.test(entry)) {
      const content = readFileSync(full, 'utf-8');
      if (content.includes(OLD)) {
        writeFileSync(full, content.split(OLD).join(target));
      }
    }
  }
}

// 1) Renombra el directorio de la app.
renameSync(oldDir, newDir);
// 2) Reemplaza el identificador en los archivos de la app.
walk(newDir);

// 3) Actualiza .env.example (comentarios/URLs de referencia).
const envPath = join(ROOT, '.env.example');
if (existsSync(envPath)) {
  const env = readFileSync(envPath, 'utf-8');
  if (env.includes(OLD)) writeFileSync(envPath, env.split(OLD).join(target));
}

console.log(`✅ Renombrado ${OLD} -> ${target}`);
console.log('Revisa el diff, ajusta el nombre de la BD (icms_core) si aplica y ejecuta: pnpm install && npx nx build ' + target);
