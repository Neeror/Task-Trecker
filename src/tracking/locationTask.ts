import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getLiveRun, ingestGeoSamples } from '@/storage/runsRepo';
import { emitRunUpdated } from '@/tracking/runEvents';
import type { GeoSample } from '@/logic/runMetrics';

export const RUN_LOCATION_TASK = 'run-location-updates';

type LocationTaskData = { locations: Location.LocationObject[] };

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

/**
 * Таск оголошений на верхньому рівні модуля — інакше після рестарту процесу
 * (ОС підняла апку в бекграунді) TaskManager не знайде обробник і викине точки.
 * Модуль імпортується в app/_layout.tsx саме заради цього сайд-ефекту.
 */
TaskManager.defineTask<LocationTaskData>(
  RUN_LOCATION_TASK,
  async ({ data, error }) => {
    if (error !== null) {
      if (__DEV__) console.error('[locationTask]', error.message);
      return;
    }
    const locations = data?.locations ?? [];
    if (locations.length === 0) return;

    try {
      const run = await getLiveRun();
      if (run === null || run.status !== 'active') {
        // Сироти буває: юзер завершив пробіжку, а ОС ще досилає батч.
        await stopRunUpdates();
        return;
      }
      const result = await ingestGeoSamples(run.id, locations.map(toSample));
      if (result.accepted > 0) emitRunUpdated();
    } catch (e) {
      if (__DEV__) console.error('[locationTask] ingest:', e);
    }
  },
);

export async function isTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function startRunUpdates(): Promise<void> {
  if (await isTrackingActive()) return;

  await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    // 5 м / 2 с — компроміс: щільніше не додає точності, лише жере батарею.
    distanceInterval: 5,
    timeInterval: 2000,
    // Ніякого групування апдейтів: нам потрібен живий екран.
    deferredUpdatesInterval: 0,
    activityType: Location.ActivityType.Fitness,
    // iOS сам «допомагає» ставити GPS на паузу і губить трек на світлофорі.
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Пробіжка триває',
      notificationBody: 'Записуємо маршрут навіть із заблокованим екраном',
      notificationColor: '#4F8EF7',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopRunUpdates(): Promise<void> {
  try {
    if (await isTrackingActive()) {
      await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
    }
  } catch (e) {
    if (__DEV__) console.error('[locationTask] stop:', e);
  }
}
