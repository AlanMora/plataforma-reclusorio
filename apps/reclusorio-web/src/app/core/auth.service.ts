import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiEnvelope, TokenPair } from './models';
import { cargarTokens, decodificarJwt, guardarTokens, limpiarTokens } from './token-store';

/**
 * Autenticación y sesión (RF-AUT-*, RF-SES-*, RF-SEG-001).
 * Los claims `permissions` del access token alimentan el menú y los guards.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly tokens = signal<TokenPair | null>(cargarTokens());
  readonly claims = computed(() => {
    const par = this.tokens();
    return par ? decodificarJwt(par.accessToken) : null;
  });
  readonly autenticado = computed(() => this.tokens() !== null);
  readonly permisos = computed(() => this.claims()?.permissions ?? []);
  readonly roles = computed(() => this.claims()?.roles ?? []);
  readonly email = computed(() => this.claims()?.email ?? '');
  readonly sid = computed(() => this.claims()?.sid ?? null);

  /** Motivo mostrado en /login tras un cierre (expiración, revocación...). */
  readonly avisoLogout = signal<string | null>(null);

  private refreshEnCurso: Promise<string> | null = null;

  tiene(permiso: string): boolean {
    return this.permisos().includes(permiso);
  }

  /** RF-AUT-001..003: login con error genérico (el backend no filtra cuentas). */
  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<TokenPair>>('/api/v1/auth/login', { email, password }),
    );
    this.avisoLogout.set(null);
    this.establecer(res.data);
  }

  /**
   * RF-SES-005/008: el refresh ROTA el par y renueva la vigencia de 30 min.
   * Single-flight: llamadas concurrentes comparten la misma promesa (reusar
   * un refresh token viejo revoca la sesión completa en el backend).
   */
  refrescar(): Promise<string> {
    if (!this.refreshEnCurso) {
      this.refreshEnCurso = this.ejecutarRefresh().finally(() => {
        this.refreshEnCurso = null;
      });
    }
    return this.refreshEnCurso;
  }

  private async ejecutarRefresh(): Promise<string> {
    const refreshToken = this.tokens()?.refreshToken;
    if (!refreshToken) throw new Error('Sin refresh token');
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<TokenPair>>('/api/v1/auth/refresh', { refreshToken }),
    );
    this.establecer(res.data);
    return res.data.accessToken;
  }

  /** RF-SES-006: logout voluntario — revoca la sesión en Redis. */
  cerrarSesion(): void {
    if (this.tokens()) {
      this.http.post('/api/v1/auth/logout', {}).subscribe({ error: () => undefined });
    }
    this.limpiar('Cerraste tu sesión correctamente.');
  }

  /** Cierre involuntario: expiración (RF-SES-002) o revocación (RF-SES-009). */
  forzarLogout(motivo: string): void {
    this.limpiar(motivo);
  }

  private establecer(par: TokenPair): void {
    guardarTokens(par);
    this.tokens.set(par);
  }

  private limpiar(aviso: string | null): void {
    limpiarTokens();
    this.tokens.set(null);
    this.avisoLogout.set(aviso);
    void this.router.navigateByUrl('/login');
  }
}
