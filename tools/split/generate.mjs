#!/usr/bin/env node
/**
 * Genera el "polyrepo" a partir de este monorepo, en .split-out/:
 *   - base-shared                -> paquete @c5desarrollos/shared (GitHub Packages)
 *   - base-<servicio>-service    -> cada microservicio autocontenido
 *
 * No publica ni hace push (de eso se encarga tools/split-and-push.sh).
 * Reutiliza el código real de libs/ y apps/, reescribiendo los imports
 * @icms/* -> @c5desarrollos/shared/*.
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, '.split-out');
const SCOPE = process.env.SCOPE || '@c5desarrollos';
const SHARED = `${SCOPE}/shared`;
const REGISTRY_HOST = 'npm.pkg.github.com';

const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const ver = (name) =>
  rootPkg.dependencies?.[name] || rootPkg.devDependencies?.[name] || 'latest';
const deps = (names) => Object.fromEntries(names.map((n) => [n, ver(n)]));

const LIBS = ['common', 'config', 'logging', 'auth', 'database', 'messaging', 'observability', 'contracts', 'redis'];

// Dependencias comunes a todos los servicios (además de @c5desarrollos/shared).
const COMMON = [
  '@nestjs/common', '@nestjs/core', '@nestjs/config', '@nestjs/platform-express',
  '@nestjs/swagger', '@nestjs/terminus', '@willsoto/nestjs-prometheus', 'prom-client',
  'helmet', 'nestjs-pino', 'pino-http', 'class-transformer', 'class-validator',
  'reflect-metadata', 'rxjs',
];

const SERVICES = [
  { repo: 'base-gateway-service', dir: 'gateway-service', port: 3000,
    extra: ['@nestjs/jwt', '@nestjs/throttler', '@nest-lab/throttler-storage-redis', 'http-proxy-middleware', 'ioredis'] },
  { repo: 'base-auth-service', dir: 'auth-service', port: 3001,
    extra: ['@nestjs/jwt', '@nestjs/passport', '@nestjs/typeorm', 'typeorm', 'pg', 'passport', 'passport-jwt', 'bcryptjs', 'ioredis', '@golevelup/nestjs-rabbitmq'] },
  { repo: 'base-configuration-service', dir: 'configuration-service', port: 3002,
    extra: ['@nestjs/jwt', '@nestjs/passport', '@nestjs/typeorm', 'typeorm', 'pg', 'passport', 'passport-jwt', '@golevelup/nestjs-rabbitmq'] },
  { repo: 'base-core-domain-service', dir: 'core-domain-service', port: 3003,
    extra: ['@nestjs/jwt', '@nestjs/passport', '@nestjs/typeorm', 'typeorm', 'pg', 'passport', 'passport-jwt', '@golevelup/nestjs-rabbitmq'] },
  { repo: 'base-reporting-service', dir: 'reporting-service', port: 3004,
    extra: ['@nestjs/jwt', '@nestjs/passport', '@nestjs/typeorm', 'typeorm', 'pg', 'passport', 'passport-jwt', 'exceljs', 'pdfkit'] },
  { repo: 'base-notification-service', dir: 'notification-service', port: 3005,
    extra: ['@nestjs/jwt', '@nestjs/passport', '@nestjs/typeorm', 'typeorm', 'pg', 'passport', 'passport-jwt', 'nodemailer', '@golevelup/nestjs-rabbitmq'] },
  { repo: 'base-integration-service', dir: 'integration-service', port: 3006,
    extra: ['@nestjs/jwt', '@nestjs/passport', '@nestjs/typeorm', 'typeorm', 'pg', 'passport', 'passport-jwt', '@golevelup/nestjs-rabbitmq'] },
  { repo: 'base-file-service', dir: 'file-service', port: 3007,
    extra: ['@nestjs/jwt', '@nestjs/passport', '@nestjs/typeorm', 'typeorm', 'pg', 'passport', 'passport-jwt', '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner', '@golevelup/nestjs-rabbitmq'] },
  { repo: 'base-scheduler-service', dir: 'scheduler-service', port: 3008,
    extra: ['@nestjs/jwt', '@nestjs/passport', '@nestjs/schedule', '@nestjs/typeorm', 'typeorm', 'pg', 'passport', 'passport-jwt', 'ioredis', 'redlock'] },
  { repo: 'base-realtime-service', dir: 'realtime-service', port: 3009,
    extra: ['@nestjs/jwt', '@nestjs/websockets', '@nestjs/platform-socket.io', 'socket.io', '@socket.io/redis-adapter', 'ioredis'] },
];

const DEV = ['@nestjs/cli', '@nestjs/schematics', 'typescript', '@types/node', '@types/express'];

// ---- helpers ---------------------------------------------------------------

/**
 * Reescribe imports @icms/*.
 *  - mode 'subpath' (base-shared interno): @icms/common -> @c5desarrollos/shared/common
 *    (resuelto por paths al compilar y por "exports" en runtime).
 *  - mode 'barrel' (servicios consumidores): @icms/common -> @c5desarrollos/shared
 *    (un solo entrypoint; compatible con moduleResolution "node" clásico, que no
 *    lee "exports" de subpaths).
 */
function rewriteImports(dir, mode) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) rewriteImports(full, mode);
    else if (full.endsWith('.ts')) {
      let src = readFileSync(full, 'utf8');
      if (!src.includes('@icms/')) continue;
      src = mode === 'barrel'
        ? src.replace(/@icms\/[a-z-]+/g, SHARED)
        : src.replaceAll('@icms/', `${SHARED}/`);
      writeFileSync(full, src);
    }
  }
}

const npmrc = `${SCOPE}:registry=https://${REGISTRY_HOST}\n//${REGISTRY_HOST}/:_authToken=\${NODE_AUTH_TOKEN}\n`;

function write(repo, rel, content) {
  const dest = join(OUT, repo, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
}

// ---- base-shared -----------------------------------------------------------

function genShared() {
  const repo = 'base-shared';
  rmSync(join(OUT, repo), { recursive: true, force: true });
  for (const lib of LIBS) {
    cpSync(join(ROOT, 'libs', lib, 'src'), join(OUT, repo, 'src', lib), { recursive: true });
  }
  rewriteImports(join(OUT, repo, 'src'), 'subpath');
  // Barrel plano: los consumidores importan todo desde `@c5desarrollos/shared`.
  write(repo, 'src/index.ts', LIBS.map((l) => `export * from './${l}';`).join('\n') + '\n');

  const pkg = {
    name: SHARED,
    version: '1.0.0',
    description: 'Núcleo compartido reutilizable para microservicios NestJS',
    license: 'UNLICENSED',
    type: 'commonjs',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    files: ['dist'],
    exports: {
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      ...Object.fromEntries(LIBS.map((l) => [`./${l}`, { types: `./dist/${l}/index.d.ts`, default: `./dist/${l}/index.js` }])),
    },
    scripts: { build: 'tsc -p tsconfig.build.json', prepublishOnly: 'npm run build' },
    publishConfig: { registry: `https://${REGISTRY_HOST}` },
    repository: { type: 'git', url: `git+https://github.com/C5Desarrollos/${repo}.git` },
    dependencies: deps([
      '@golevelup/nestjs-rabbitmq', '@nestjs/common', '@nestjs/config', '@nestjs/core',
      '@nestjs/jwt', '@nestjs/passport', '@nestjs/swagger', '@nestjs/terminus', '@nestjs/typeorm',
      '@willsoto/nestjs-prometheus', 'class-transformer', 'class-validator', 'ioredis',
      'nestjs-pino', 'passport', 'passport-jwt', 'pino-http', 'prom-client', 'reflect-metadata',
      'rxjs', 'typeorm',
    ]),
    peerDependencies: deps(['pg']),
    devDependencies: deps(['typescript', '@types/node']),
  };
  write(repo, 'package.json', JSON.stringify(pkg, null, 2) + '\n');

  write(repo, 'tsconfig.build.json', JSON.stringify({
    compilerOptions: {
      module: 'commonjs', moduleResolution: 'node', target: 'es2021', lib: ['es2021'],
      declaration: true, emitDecoratorMetadata: true, experimentalDecorators: true,
      esModuleInterop: true, resolveJsonModule: true, skipLibCheck: true, strict: true,
      outDir: 'dist', rootDir: 'src', baseUrl: '.', paths: { [`${SHARED}/*`]: ['src/*'] },
    },
    include: ['src/**/*.ts'],
  }, null, 2) + '\n');

  write(repo, '.npmrc', npmrc);
  write(repo, '.gitignore', 'node_modules\ndist\n*.log\n');
  write(repo, '.github/workflows/publish.yml', `name: publish
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://${REGISTRY_HOST}'
      - run: corepack enable
      - run: pnpm install --no-frozen-lockfile
      - run: pnpm build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`);
  write(repo, 'README.md', `# ${SHARED}\n\nNúcleo compartido de la plataforma base (auth, logging, database, messaging, observability, redis, contracts).\n\nPublicar una versión:\n\n\`\`\`bash\nnpm version patch && git push --follow-tags   # el workflow publica a GitHub Packages\n\`\`\`\n\nConsumir en un servicio:\n\n\`\`\`ts\nimport { JwtAuthGuard } from '${SHARED}/auth';\nimport { ApiResponse } from '${SHARED}/common';\n\`\`\`\n`);
  console.log('generado: base-shared');
}

// ---- servicios -------------------------------------------------------------

function genService(svc) {
  const { repo, dir, port, extra } = svc;
  rmSync(join(OUT, repo), { recursive: true, force: true });
  cpSync(join(ROOT, 'apps', dir, 'src'), join(OUT, repo, 'src'), { recursive: true });
  rewriteImports(join(OUT, repo, 'src'), 'barrel');

  const runtime = { [SHARED]: '^1.0.0', ...deps([...COMMON, ...extra]) };
  const typeExtra = [];
  if (extra.includes('bcryptjs')) typeExtra.push('@types/bcryptjs');
  if (extra.includes('passport-jwt')) typeExtra.push('@types/passport-jwt');
  if (extra.includes('nodemailer')) typeExtra.push('@types/nodemailer');
  if (extra.includes('pdfkit')) typeExtra.push('@types/pdfkit');
  if (extra.some((e) => e.includes('multer')) || dir === 'file-service') typeExtra.push('@types/multer');

  const pkg = {
    name: repo,
    version: '1.0.0',
    private: true,
    license: 'UNLICENSED',
    scripts: {
      build: 'nest build',
      start: 'node dist/main.js',
      'start:dev': 'nest start --watch',
    },
    dependencies: runtime,
    devDependencies: deps([...DEV, ...typeExtra]),
  };
  write(repo, 'package.json', JSON.stringify(pkg, null, 2) + '\n');

  write(repo, 'nest-cli.json', JSON.stringify({
    collection: '@nestjs/schematics', sourceRoot: 'src', compilerOptions: { deleteOutDir: true },
  }, null, 2) + '\n');

  write(repo, 'tsconfig.json', JSON.stringify({
    compilerOptions: {
      module: 'commonjs', target: 'es2021', moduleResolution: 'node',
      emitDecoratorMetadata: true, experimentalDecorators: true, esModuleInterop: true,
      resolveJsonModule: true, declaration: false, outDir: './dist', baseUrl: './',
      skipLibCheck: true, strict: true, forceConsistentCasingInFileNames: true,
      types: dir === 'file-service' ? ['node', 'multer'] : ['node'],
    },
    include: ['src/**/*.ts'],
  }, null, 2) + '\n');

  write(repo, '.npmrc', npmrc);
  write(repo, '.dockerignore', 'node_modules\ndist\n.git\n*.log\n.env\n');
  write(repo, '.gitignore', 'node_modules\ndist\n*.log\n.env\n');
  write(repo, '.env.example', `NODE_ENV=development\nPORT=${port}\nJWT_SECRET=change-me\n`);

  write(repo, 'Dockerfile', `# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json .npmrc ./
RUN --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
COPY package.json .npmrc ./
RUN --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN pnpm install --prod --no-frozen-lockfile \\
    && chown -R node:node /app
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]
`);

  write(repo, 'README.md', `# ${repo}\n\nMicroservicio de la plataforma base. Depende de \`${SHARED}\` (GitHub Packages).\n\n## Desarrollo\n\n\`\`\`bash\nexport NODE_AUTH_TOKEN=<tu_token_read:packages>\npnpm install\npnpm start:dev\n\`\`\`\n\n## Docker\n\n\`\`\`bash\ndocker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -t ${repo} .\n\`\`\`\n`);
  console.log('generado:', repo);
}

// ---- run -------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });
genShared();
for (const svc of SERVICES) genService(svc);
console.log(`\nListo. Repos generados en ${OUT}`);
