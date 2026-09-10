const EARTH_RADIUS_M = 6_371_008.8;
const DEG_TO_RAD = Math.PI / 180;

export type LatLon = { lat: number; lon: number };

/** Відстань по великому колу, метри. Haversine — точності з головою на масштабі пробіжки. */
export function haversineM(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ─────────────── Форматування ─────────────── */

const pad2 = (n: number): string => String(Math.floor(n)).padStart(2, '0');

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0 м';
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(2).replace('.', ',')} км`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Темп у мс на кілометр. 0 якщо ще нічого не пробігли. */
export function paceMsPerKm(distanceM: number, durationMs: number): number {
  if (distanceM < 1 || durationMs <= 0) return 0;
  return durationMs / (distanceM / 1000);
}

export function formatPace(msPerKm: number): string {
  if (!Number.isFinite(msPerKm) || msPerKm <= 0) return '--:--';
  // Понад 30 хв/км — це вже не біг, показувати таке число безглуздо.
  if (msPerKm > 30 * 60_000) return '--:--';
  const totalSec = Math.round(msPerKm / 1000);
  return `${Math.floor(totalSec / 60)}:${pad2(totalSec % 60)}`;
}

export function formatSpeedKmh(distanceM: number, durationMs: number): string {
  if (distanceM < 1 || durationMs <= 0) return '0,0';
  const kmh = distanceM / 1000 / (durationMs / 3_600_000);
  return kmh.toFixed(1).replace('.', ',');
}
