import { haversineM, paceMsPerKm, type LatLon } from '@/logic/geo';
import type { Run, RunPoint } from '@/types';

/** Сира вибірка від GPS, ще не збережена. */
export type GeoSample = {
  lat: number;
  lon: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  recordedAt: number;
};

export type RunFilters = {
  /** Точки з гіршою точністю просто брехня — у місті таких багато. */
  maxAccuracyM: number;
  /** Дрібніші зміщення на місці — це джитер, а не рух. */
  minStepM: number;
  /** 9 м/с ≈ 1:51/км. Швидше за це людина не бігає — це стрибок GPS. */
  maxSpeedMps: number;
  /** Нижче цього не рахуємо час «у руху» (автопауза). */
  minMovingSpeedMps: number;
  /** Пауза між точками більша за це = втрата сигналу: рвемо трек, дистанцію не додаємо. */
  maxGapMs: number;
  minAscentStepM: number;
};

export const DEFAULT_RUN_FILTERS: RunFilters = {
  maxAccuracyM: 25,
  minStepM: 3,
  maxSpeedMps: 9,
  minMovingSpeedMps: 0.6,
  maxGapMs: 20_000,
  minAscentStepM: 1.5,
};

export type RunAccumulator = {
  /** seq останньої збереженої точки, -1 якщо ще жодної. */
  seq: number;
  distanceM: number;
  movingMs: number;
  ascentM: number;
  last: GeoSample | null;
};

export const EMPTY_ACCUMULATOR: RunAccumulator = {
  seq: -1,
  distanceM: 0,
  movingMs: 0,
  ascentM: 0,
  last: null,
};

export type RejectReason =
  | 'invalid-coords'
  | 'low-accuracy'
  | 'out-of-order'
  | 'too-close'
  | 'implausible-speed';

export type IngestOutcome = {
  accepted: boolean;
  reason: RejectReason | null;
  /** Точка починає новий сегмент треку (перша або після втрати сигналу). */
  segmentBreak: boolean;
  acc: RunAccumulator;
};

export function accumulatorFromRun(
  run: Run,
  lastPoint: RunPoint | null,
): RunAccumulator {
  return {
    seq: lastPoint?.seq ?? -1,
    distanceM: run.distanceM,
    movingMs: run.movingMs,
    ascentM: run.ascentM,
    last:
      lastPoint === null
        ? null
        : {
            lat: lastPoint.lat,
            lon: lastPoint.lon,
            altitude: lastPoint.altitude,
            accuracy: lastPoint.accuracy,
            speed: lastPoint.speed,
            recordedAt: lastPoint.recordedAt,
          },
  };
}

function isValidCoord(sample: GeoSample): boolean {
  return (
    Number.isFinite(sample.lat) &&
    Number.isFinite(sample.lon) &&
    Math.abs(sample.lat) <= 90 &&
    Math.abs(sample.lon) <= 180 &&
    Number.isFinite(sample.recordedAt) &&
    sample.recordedAt > 0
  );
}

function reject(acc: RunAccumulator, reason: RejectReason): IngestOutcome {
  return { accepted: false, reason, segmentBreak: false, acc };
}

/**
 * Серце фічі й єдине місце, де вирішується «чи це реальний рух».
 * Чиста функція: тестується без GPS, девайса і БД.
 */
export function ingestSample(
  acc: RunAccumulator,
  sample: GeoSample,
  filters: RunFilters = DEFAULT_RUN_FILTERS,
): IngestOutcome {
  if (!isValidCoord(sample)) return reject(acc, 'invalid-coords');
  if (sample.accuracy !== null && sample.accuracy > filters.maxAccuracyM) {
    return reject(acc, 'low-accuracy');
  }

  const { last } = acc;

  if (last === null) {
    return {
      accepted: true,
      reason: null,
      segmentBreak: true,
      acc: { ...acc, seq: acc.seq + 1, last: sample },
    };
  }

  const dtMs = sample.recordedAt - last.recordedAt;
  if (dtMs <= 0) return reject(acc, 'out-of-order');

  // Втрата сигналу: пряма лінія через діру збрехала б на сотні метрів.
  // Точку зберігаємо (це початок нового сегмента), дистанцію — ні.
  if (dtMs > filters.maxGapMs) {
    return {
      accepted: true,
      reason: null,
      segmentBreak: true,
      acc: { ...acc, seq: acc.seq + 1, last: sample },
    };
  }

  const from: LatLon = { lat: last.lat, lon: last.lon };
  const distanceM = haversineM(from, sample);
  const speedMps = distanceM / (dtMs / 1000);

  if (speedMps > filters.maxSpeedMps) return reject(acc, 'implausible-speed');
  if (distanceM < filters.minStepM) return reject(acc, 'too-close');

  let ascentM = acc.ascentM;
  if (last.altitude !== null && sample.altitude !== null) {
    const dAlt = sample.altitude - last.altitude;
    if (dAlt >= filters.minAscentStepM) ascentM += dAlt;
  }

  return {
    accepted: true,
    reason: null,
    segmentBreak: false,
    acc: {
      seq: acc.seq + 1,
      distanceM: acc.distanceM + distanceM,
      movingMs:
        speedMps >= filters.minMovingSpeedMps
          ? acc.movingMs + dtMs
          : acc.movingMs,
      ascentM,
      last: sample,
    },
  };
}

export type AcceptedSample = { seq: number; sample: GeoSample };

export function ingestSamples(
  acc: RunAccumulator,
  samples: readonly GeoSample[],
  filters: RunFilters = DEFAULT_RUN_FILTERS,
): { acc: RunAccumulator; accepted: AcceptedSample[] } {
  let current = acc;
  const accepted: AcceptedSample[] = [];

  const ordered = [...samples].sort((a, b) => a.recordedAt - b.recordedAt);
  for (const sample of ordered) {
    const outcome = ingestSample(current, sample, filters);
    current = outcome.acc;
    if (outcome.accepted) accepted.push({ seq: current.seq, sample });
  }

  return { acc: current, accepted };
}

/* ─────────────── Час ─────────────── */

/** Час від старту без пауз. Рахується від таймстемпів, а не JS-таймера, тому не «з'їжджає» у бекграунді. */
export function elapsedMs(run: Run, now: number): number {
  const end = run.endedAt ?? now;
  const openPause = run.pausedAt === null ? 0 : Math.max(0, now - run.pausedAt);
  return Math.max(0, end - run.startedAt - run.pausedMs - openPause);
}

export function isRunGoalMet(run: Run): boolean {
  if (run.targetDistanceM === null) return true;
  // 1% допуску: GPS ніколи не дасть рівно 10 000 м.
  return run.distanceM >= run.targetDistanceM * 0.99;
}

export function remainingM(run: Run): number {
  if (run.targetDistanceM === null) return 0;
  return Math.max(0, run.targetDistanceM - run.distanceM);
}

/* ─────────────── Спліти ─────────────── */

export type Split = {
  index: number;
  distanceM: number;
  durationMs: number;
  paceMsPerKm: number;
  partial: boolean;
};

/** Розбиває трек на кілометрові спліти з інтерполяцією часу на межі кілометра. */
export function computeSplits(
  points: readonly RunPoint[],
  splitM = 1000,
  filters: RunFilters = DEFAULT_RUN_FILTERS,
): Split[] {
  const splits: Split[] = [];
  let splitDist = 0;
  let splitTime = 0;
  let index = 1;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    if (prev === undefined || cur === undefined) continue;

    const dtMs = cur.recordedAt - prev.recordedAt;
    if (dtMs <= 0 || dtMs > filters.maxGapMs) continue;

    let remD = haversineM(prev, cur);
    let remT = dtMs;

    while (splitDist + remD >= splitM && remD > 0) {
      const needed = splitM - splitDist;
      const frac = needed / remD;
      const tSlice = remT * frac;
      splits.push({
        index,
        distanceM: splitM,
        durationMs: splitTime + tSlice,
        paceMsPerKm: paceMsPerKm(splitM, splitTime + tSlice),
        partial: false,
      });
      index += 1;
      remD -= needed;
      remT -= tSlice;
      splitDist = 0;
      splitTime = 0;
    }

    splitDist += remD;
    splitTime += remT;
  }

  if (splitDist >= 50) {
    splits.push({
      index,
      distanceM: splitDist,
      durationMs: splitTime,
      paceMsPerKm: paceMsPerKm(splitDist, splitTime),
      partial: true,
    });
  }

  return splits;
}

/* ─────────────── Геометрія для малювання ─────────────── */

/** Трек рветься там, де зникав сигнал: інакше на карті буде пряма через пів міста. */
export function buildSegments(
  points: readonly RunPoint[],
  maxGapMs: number = DEFAULT_RUN_FILTERS.maxGapMs,
): RunPoint[][] {
  const segments: RunPoint[][] = [];
  let current: RunPoint[] = [];

  for (const point of points) {
    const prev = current[current.length - 1];
    if (prev !== undefined && point.recordedAt - prev.recordedAt > maxGapMs) {
      if (current.length > 0) segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

export type Bounds = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

export function boundsOf(points: readonly LatLon[]): Bounds | null {
  const first = points[0];
  if (first === undefined) return null;

  let bounds: Bounds = {
    minLat: first.lat,
    maxLat: first.lat,
    minLon: first.lon,
    maxLon: first.lon,
  };
  for (const p of points) {
    bounds = {
      minLat: Math.min(bounds.minLat, p.lat),
      maxLat: Math.max(bounds.maxLat, p.lat),
      minLon: Math.min(bounds.minLon, p.lon),
      maxLon: Math.max(bounds.maxLon, p.lon),
    };
  }
  return bounds;
}

export type Box = { width: number; height: number; padding: number };
export type ScreenPoint = { x: number; y: number };

/**
 * Еквідистантна проєкція зі стисканням по довготі на cos(lat).
 * Без цього маршрут на широті Києва виглядав би розтягнутим ~вдвічі.
 */
export function projectSegments(
  segments: readonly (readonly LatLon[])[],
  bounds: Bounds,
  box: Box,
): ScreenPoint[][] {
  const midLat = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180);
  const lonScale = Math.max(0.01, Math.cos(midLat));

  const spanX = Math.max(1e-9, (bounds.maxLon - bounds.minLon) * lonScale);
  const spanY = Math.max(1e-9, bounds.maxLat - bounds.minLat);

  const innerW = Math.max(1, box.width - box.padding * 2);
  const innerH = Math.max(1, box.height - box.padding * 2);
  const scale = Math.min(innerW / spanX, innerH / spanY);

  const offsetX = box.padding + (innerW - spanX * scale) / 2;
  const offsetY = box.padding + (innerH - spanY * scale) / 2;

  return segments.map((segment) =>
    segment.map((p) => ({
      x: offsetX + (p.lon - bounds.minLon) * lonScale * scale,
      // y інвертований: широта росте вгору, координати екрана — вниз.
      y: offsetY + (bounds.maxLat - p.lat) * scale,
    })),
  );
}
