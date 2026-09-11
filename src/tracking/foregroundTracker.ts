import * as Location from 'expo-location';
import { getLiveRun, ingestGeoSamples } from '@/storage/runsRepo';
import { emitRunUpdated } from '@/tracking/runEvents';
import type { GeoSample } from '@/logic/runMetrics';

/**
 * Запис треку без foreground service: звичайний watchPositionAsync.
 * Працює лише поки апка жива, зате не вміє падати нативно і не потребує
 * ні дозволу «Завжди», ні dev build. Це наш безпечний дефолт; фонову
 * службу підіймаємо тільки коли для неї реально є всі умови.
 *
 * Точки йдуть у той самий ingestGeoSamples, що й background-таск, тому
 * фільтри, дистанція і сегменти рахуються однаково.
 */

let subscription: Location.LocationSubscription | null = null;

function toSample(location: Location.LocationObject): GeoSample {
  const { coords, timestamp } = location;
  return {
    lat: coords.latitude,
    lon: coords.longitude,
    altitude: coords.altitude ?? null,
    accuracy: coords.accuracy ?? null,
    speed: coords.speed ?? null,
    recordedAt: Math.round(timestamp),
  };
}

async function handle(location: Location.LocationObject): Promise<void> {
  try {
    const run = await getLiveRun();
    if (run === null || run.status !== 'active') {
      await stopForegroundTracking();
      return;
    }
    const result = await ingestGeoSamples(run.id, [toSample(location)]);
    if (result.accepted > 0) emitRunUpdated();
  } catch (e) {
    if (__DEV__) console.error('[foregroundTracker] ingest:', e);
  }
}

export function isForegroundTrackingActive(): boolean {
  return subscription !== null;
}

export async function startForegroundTracking(): Promise<void> {
  if (subscription !== null) return;

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      // Ті самі 5 м / 2 с, що й у background-таску: метрики не залежать від режиму.
      distanceInterval: 5,
      timeInterval: 2000,
    },
    (location) => void handle(location),
  );
}

export async function stopForegroundTracking(): Promise<void> {
  const current = subscription;
  subscription = null;
  try {
    current?.remove();
  } catch (e) {
    if (__DEV__) console.error('[foregroundTracker] stop:', e);
  }
}
