import { Route } from '@angular/router';
import { authGuard, permisoGuard } from './core/guards';

/**
 * RF-UI: /login público; el resto vive en el layout privado protegido por
 * authGuard, y cada módulo declara su permiso (RF-SEG-001/002).
 */
export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'personas',
        canActivate: [permisoGuard],
        data: { permiso: 'personas:consultar' },
        loadComponent: () =>
          import('./pages/personas/personas-list.component').then((m) => m.PersonasListComponent),
      },
      {
        path: 'personas/nueva',
        canActivate: [permisoGuard],
        data: { permiso: 'personas:crear' },
        loadComponent: () =>
          import('./pages/personas/persona-nueva.component').then((m) => m.PersonaNuevaComponent),
      },
      {
        path: 'personas/:idPersona',
        canActivate: [permisoGuard],
        data: { permiso: 'personas:consultar' },
        loadComponent: () =>
          import('./pages/personas/persona-detail.component').then((m) => m.PersonaDetailComponent),
      },
      {
        path: 'elementos',
        canActivate: [permisoGuard],
        data: { permiso: 'elementos:consultar' },
        loadComponent: () =>
          import('./pages/elementos/elementos.component').then((m) => m.ElementosComponent),
      },
      {
        path: 'incidencias',
        canActivate: [permisoGuard],
        data: { permiso: 'incidencias:consultar' },
        loadComponent: () =>
          import('./pages/incidencias/incidencias-list.component').then(
            (m) => m.IncidenciasListComponent,
          ),
      },
      {
        path: 'incidencias/nueva',
        canActivate: [permisoGuard],
        data: { permiso: 'incidencias:crear' },
        loadComponent: () =>
          import('./pages/incidencias/incidencia-nueva.component').then(
            (m) => m.IncidenciaNuevaComponent,
          ),
      },
      {
        path: 'incidencias/:idIncidencia',
        canActivate: [permisoGuard],
        data: { permiso: 'incidencias:consultar' },
        loadComponent: () =>
          import('./pages/incidencias/incidencia-detail.component').then(
            (m) => m.IncidenciaDetailComponent,
          ),
      },
      {
        path: 'catalogos',
        canActivate: [permisoGuard],
        data: { permiso: 'catalogos:administrar' },
        loadComponent: () =>
          import('./pages/catalogos/catalogos.component').then((m) => m.CatalogosComponent),
      },
      {
        path: 'penitenciarios',
        loadComponent: () =>
          import('./pages/penitenciarios/penitenciarios.component').then(
            (m) => m.PenitenciariosComponent,
          ),
      },
      {
        path: 'notificaciones',
        loadComponent: () =>
          import('./pages/notificaciones.component').then((m) => m.NotificacionesComponent),
      },
      {
        path: 'cuenta',
        loadComponent: () => import('./pages/cuenta.component').then((m) => m.CuentaComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
