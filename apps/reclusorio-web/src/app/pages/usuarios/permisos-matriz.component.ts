import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface ModuloPermisos {
  modulo: string;
  permisos: string[];
}

const ICONOS: Record<string, string> = {
  Personas: '◉',
  Elementos: '⬡',
  'Ingresos / Libertades': '⇄',
  Movimientos: '⇅',
  Audiencias: '⚖',
  Traslados: '➔',
  Incidencias: '▲',
  Archivos: '▤',
  Catálogos: '≡',
  'Usuarios (administración)': '♟',
};

const ETIQUETAS: Record<string, string> = {
  'users:read': 'ver usuarios',
  'users:write': 'crear/editar usuarios',
  'permissions:write': 'asignar permisos',
};

/**
 * Matriz de permisos "consola de mando": tarjetas por módulo con interruptor
 * maestro, barra de avance y pills interactivas por acción, más presets
 * (todos / solo consulta / ninguno). Componente controlado: recibe la
 * selección y emite el conjunto nuevo en cada cambio — la usan el alta y la
 * edición de usuarios sin duplicar marcado.
 */
@Component({
  selector: 'rw-permisos-matriz',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <!-- Resumen + presets -->
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borde bg-panel-2/60 px-4 py-3">
        <div class="flex items-center gap-4">
          <div class="flex items-baseline gap-1">
            <span class="text-2xl font-semibold text-neon">{{ seleccion().size }}</span>
            <span class="etiqueta">/ {{ total() }} permisos</span>
          </div>
          <div class="h-1.5 w-36 overflow-hidden rounded-full bg-borde">
            <div
              class="h-full rounded-full bg-gradient-to-r from-neon to-neon-2 transition-all duration-300"
              [style.width.%]="porcentaje()"
            ></div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn-secundario btn-mini" type="button" (click)="presetTodos()">
            ◈ Acceso total
          </button>
          <button class="btn-secundario btn-mini" type="button" (click)="presetConsulta()">
            ◎ Solo consulta
          </button>
          <button class="btn-secundario btn-mini" type="button" (click)="presetNinguno()">
            ∅ Ninguno
          </button>
        </div>
      </div>

      <!-- Tarjetas por módulo -->
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        @for (m of catalogo(); track m.modulo) {
          <div
            class="rounded-lg border bg-panel-2/50 p-3 transition-all duration-200"
            [class]="
              moduloCompleto(m)
                ? 'border-neon/40 shadow-[0_0_18px_rgba(34,211,238,0.10)]'
                : cuentaModulo(m) > 0
                  ? 'border-neon/15'
                  : 'border-borde'
            "
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <span class="flex items-center gap-2 text-sm font-medium">
                <span
                  class="transition-colors"
                  [class]="cuentaModulo(m) > 0 ? 'text-neon' : 'text-slate-600'"
                  >{{ icono(m.modulo) }}</span
                >
                {{ m.modulo }}
                <span class="etiqueta">{{ cuentaModulo(m) }}/{{ m.permisos.length }}</span>
              </span>
              <!-- Interruptor maestro del módulo -->
              <button
                type="button"
                class="relative h-4 w-8 shrink-0 rounded-full transition-colors duration-200"
                [class]="moduloCompleto(m) ? 'bg-neon/80' : 'bg-borde'"
                [attr.aria-label]="'Alternar módulo ' + m.modulo"
                [attr.aria-pressed]="moduloCompleto(m)"
                (click)="alternarModulo(m)"
              >
                <span
                  class="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200"
                  [class]="moduloCompleto(m) ? 'left-[18px]' : 'left-0.5'"
                ></span>
              </button>
            </div>

            <div class="mb-2 h-0.5 overflow-hidden rounded-full bg-borde/70">
              <div
                class="h-full rounded-full bg-gradient-to-r from-neon to-neon-2 transition-all duration-300"
                [style.width.%]="(cuentaModulo(m) / m.permisos.length) * 100"
              ></div>
            </div>

            <div class="flex flex-wrap gap-1.5">
              @for (p of m.permisos; track p) {
                <button
                  type="button"
                  class="rounded-full border px-2.5 py-0.5 text-[11px] transition-all duration-150"
                  [class]="
                    tiene(p)
                      ? 'border-neon/60 bg-neon/15 text-neon shadow-[0_0_10px_rgba(34,211,238,0.15)]'
                      : 'border-borde text-slate-500 hover:border-neon/30 hover:text-slate-300'
                  "
                  [attr.aria-pressed]="tiene(p)"
                  (click)="alternar(p)"
                >
                  {{ tiene(p) ? '✓ ' : '' }}{{ etiqueta(p) }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class PermisosMatrizComponent {
  readonly catalogo = input.required<ModuloPermisos[]>();
  readonly seleccion = input.required<Set<string>>();
  readonly cambio = output<Set<string>>();

  readonly total = computed(() => this.catalogo().reduce((n, m) => n + m.permisos.length, 0));
  readonly porcentaje = computed(() =>
    this.total() === 0 ? 0 : (this.seleccion().size / this.total()) * 100,
  );

  icono(modulo: string): string {
    return ICONOS[modulo] ?? '◇';
  }

  etiqueta(permiso: string): string {
    return ETIQUETAS[permiso] ?? permiso.split(':')[1] ?? permiso;
  }

  tiene(permiso: string): boolean {
    return this.seleccion().has(permiso);
  }

  cuentaModulo(modulo: ModuloPermisos): number {
    return modulo.permisos.filter((p) => this.seleccion().has(p)).length;
  }

  moduloCompleto(modulo: ModuloPermisos): boolean {
    return modulo.permisos.every((p) => this.seleccion().has(p));
  }

  alternar(permiso: string): void {
    const nuevo = new Set(this.seleccion());
    if (nuevo.has(permiso)) nuevo.delete(permiso);
    else nuevo.add(permiso);
    this.cambio.emit(nuevo);
  }

  alternarModulo(modulo: ModuloPermisos): void {
    const nuevo = new Set(this.seleccion());
    const completo = this.moduloCompleto(modulo);
    for (const p of modulo.permisos) {
      if (completo) nuevo.delete(p);
      else nuevo.add(p);
    }
    this.cambio.emit(nuevo);
  }

  presetTodos(): void {
    this.cambio.emit(new Set(this.catalogo().flatMap((m) => m.permisos)));
  }

  /** Perfil de solo lectura: todas las acciones de consulta. */
  presetConsulta(): void {
    this.cambio.emit(
      new Set(
        this.catalogo()
          .flatMap((m) => m.permisos)
          .filter((p) => p.endsWith(':consultar') || p === 'users:read'),
      ),
    );
  }

  presetNinguno(): void {
    this.cambio.emit(new Set());
  }
}
