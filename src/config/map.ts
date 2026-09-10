import Constants from 'expo-constants';

/**
 * Стиль векторної карти. OpenFreeMap — без ключа й безкоштовно, тому це
 * дефолт. Хочеш MapTiler/свій сервер — прокинь URL через app.json → extra.mapStyleUrl,
 * код не змінюється.
 */
const FALLBACK_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

function readExtra(key: string): string | null {
  const extra = Constants.expoConfig?.extra;
  if (extra === undefined || extra === null) return null;
  const value = (extra as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export const MAP_STYLE_URL = readExtra('mapStyleUrl') ?? FALLBACK_STYLE_URL;

/** Зуми офлайн-пака: 10 — оглядово, 16 — видно вулиці й доріжки. */
export const OFFLINE_MIN_ZOOM = 10;
export const OFFLINE_MAX_ZOOM = 16;
