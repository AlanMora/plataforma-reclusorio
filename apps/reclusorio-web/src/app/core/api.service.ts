import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiEnvelope } from './models';

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * Cliente HTTP del contrato de la plataforma:
 * - Respuestas 2xx envueltas en { success, data } → aquí se desenvuelven.
 * - `forbidNonWhitelisted` en el backend → los cuerpos se LIMPIAN de
 *   campos vacíos antes de enviarse (RF-GEN-004: el backend es la autoridad).
 * - POST de alta de persona exige header `Idempotency-Key` (UUID).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(url: string, params?: Params): Promise<T> {
    return firstValueFrom(
      this.http.get<ApiEnvelope<T>>(url, { params: aHttpParams(params) }),
    ).then((r) => r.data);
  }

  post<T>(url: string, body: object, opciones?: { idempotente?: boolean }): Promise<T> {
    const headers = opciones?.idempotente ? { 'Idempotency-Key': crypto.randomUUID() } : undefined;
    return firstValueFrom(
      this.http.post<ApiEnvelope<T>>(url, limpiarCuerpo(body), { headers }),
    ).then((r) => r.data);
  }

  patch<T>(url: string, body: object): Promise<T> {
    return firstValueFrom(this.http.patch<ApiEnvelope<T>>(url, limpiarCuerpo(body))).then(
      (r) => r.data,
    );
  }

  /** Para endpoints 204 sin cuerpo (logout, change-password). */
  postSinRespuesta(url: string, body: object): Promise<void> {
    return firstValueFrom(this.http.post(url, limpiarCuerpo(body))).then(() => undefined);
  }

  delete(url: string): Promise<void> {
    return firstValueFrom(this.http.delete(url)).then(() => undefined);
  }

  /** Subida multipart (archivos → MinIO vía backend). */
  postForm<T>(url: string, form: FormData): Promise<T> {
    return firstValueFrom(this.http.post<ApiEnvelope<T>>(url, form)).then((r) => r.data);
  }
}

/** Quita '', null y undefined: los opcionales vacíos no deben viajar. */
export function limpiarCuerpo<T extends object>(body: T): Partial<T> {
  const limpio: Partial<T> = {};
  for (const [clave, valor] of Object.entries(body)) {
    if (valor === '' || valor === null || valor === undefined) continue;
    (limpio as Record<string, unknown>)[clave] = valor;
  }
  return limpio;
}

function aHttpParams(params?: Params): HttpParams | undefined {
  if (!params) return undefined;
  let hp = new HttpParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === '' || valor === null || valor === undefined) continue;
    hp = hp.set(clave, String(valor));
  }
  return hp;
}
