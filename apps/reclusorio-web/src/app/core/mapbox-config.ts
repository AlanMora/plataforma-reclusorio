interface ReclusorioRuntimeConfig {
  mapboxAccessToken?: string;
}

type ConfiguredWindow = Window & {
  __RECLUSORIO_CONFIG__?: ReclusorioRuntimeConfig;
};

/** Token publico de Mapbox inyectado desde public/mapbox-config.js. */
export function obtenerTokenMapbox(): string {
  if (typeof window === 'undefined') return '';
  return ((window as ConfiguredWindow).__RECLUSORIO_CONFIG__?.mapboxAccessToken ?? '').trim();
}
