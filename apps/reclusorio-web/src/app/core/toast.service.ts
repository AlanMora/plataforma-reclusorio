import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  tipo: 'ok' | 'error' | 'info';
  texto: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private secuencia = 0;

  ok(texto: string): void {
    this.agregar('ok', texto);
  }
  error(texto: string): void {
    const mensajes = [
      ...new Set(
        texto
          .split(/(?:\r?\n|\s+·\s+)/)
          .map((mensaje) => mensaje.trim())
          .filter(Boolean),
      ),
    ];
    for (const mensaje of mensajes) this.agregar('error', mensaje, 9000);
  }
  info(texto: string): void {
    this.agregar('info', texto);
  }

  cerrar(id: number): void {
    this.toasts.update((lista) => lista.filter((t) => t.id !== id));
  }

  private agregar(tipo: Toast['tipo'], texto: string, ttlMs = 5500): void {
    const id = ++this.secuencia;
    this.toasts.update((lista) => [...lista, { id, tipo, texto }]);
    setTimeout(() => this.cerrar(id), ttlMs);
  }
}
