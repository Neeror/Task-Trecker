import {
  MAP_STYLE_URL,
  OFFLINE_MAX_ZOOM,
  OFFLINE_MIN_ZOOM,
} from '@/config/map';
import type { Bounds } from '@/logic/runMetrics';

/* MapLibre грузимо ліниво: без нього карта деградує до SVG, а не падає. */
type OfflinePack = { name: string };
type OfflineManager = {
  getPacks: () => Promise<OfflinePack[]>;
  getPack: (name: string) => Promise<OfflinePack | null>;
  createPack: (
    options: {
      name: string;
      styleURL: string;
      minZoom: number;
      maxZoom: number;
      bounds: [[number, number], [number, number]];
    },
    onProgress?: (pack: OfflinePack, status: { percentage: number }) => void,
    onError?: (pack: OfflinePack, error: unknown) => void,
  ) => Promise<void>;
  deletePack: (name: string) => Promise<void>;
};

function loadOfflineManager(): OfflineManager | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@maplibre/maplibre-react-native') as {
      offlineManager?: OfflineManager;
    };
    return mod.offlineManager ?? null;
  } catch {
    return null;
  }
}

export const HOME_PACK_NAME = 'home-region';

function padBounds(bounds: Bounds, km: number): Bounds {
  const dLat = km / 111;
  const midLat = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180);
  const dLon = km / (111 * Math.max(0.2, Math.cos(midLat)));
  return {
    minLat: bounds.minLat - dLat,
    maxLat: bounds.maxLat + dLat,
    minLon: bounds.minLon - dLon,
    maxLon: bounds.maxLon + dLon,
  };
}

export async function isPackDownloaded(name = HOME_PACK_NAME): Promise<boolean> {
  const manager = loadOfflineManager();
  if (manager === null) return false;
  try {
    return (await manager.getPack(name)) !== null;
  } catch {
    return false;
  }
}

export type DownloadResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'failed' };

/**
 * Качає регіон навколо переданих меж (типово — навколо району твоїх пробіжок).
 * Один раз по вайфаю → далі карта працює без мережі назавжди.
 */
export async function downloadRegion(
  bounds: Bounds,
  options: { name?: string; paddingKm?: number; onProgress?: (percent: number) => void } = {},
): Promise<DownloadResult> {
  const manager = loadOfflineManager();
  if (manager === null) return { ok: false, reason: 'unavailable' };

  const name = options.name ?? HOME_PACK_NAME;
  const padded = padBounds(bounds, options.paddingKm ?? 8);

  try {
    const existing = await manager.getPack(name);
    if (existing !== null) await manager.deletePack(name);

    await manager.createPack(
      {
        name,
        styleURL: MAP_STYLE_URL,
        minZoom: OFFLINE_MIN_ZOOM,
        maxZoom: OFFLINE_MAX_ZOOM,
        // MapLibre чекає [northEast, southWest] у форматі [lon, lat].
        bounds: [
          [padded.maxLon, padded.maxLat],
          [padded.minLon, padded.minLat],
        ],
      },
      (_pack, status) => options.onProgress?.(status.percentage),
    );
    return { ok: true };
  } catch (e) {
    if (__DEV__) console.error('[offlineMap] download:', e);
    return { ok: false, reason: 'failed' };
  }
}
