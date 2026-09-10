import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/storage/database';
import {
  accumulatorFromRun,
  ingestSamples,
  type GeoSample,
} from '@/logic/runMetrics';
import {
  RunPointSchema,
  RunSchema,
  safeParse,
  type DateString,
  type Run,
  type RunPoint,
} from '@/types';

type RunRow = {
  id: string;
  task_id: string | null;
  date: string;
  status: string;
  started_at: number;
  ended_at: number | null;
  paused_at: number | null;
  paused_ms: number;
  moving_ms: number;
  distance_m: number;
  ascent_m: number;
  target_distance_m: number | null;
};

type RunPointRow = {
  run_id: string;
  seq: number;
  lat: number;
  lon: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  recorded_at: number;
};

function rowToRun(row: RunRow): Run | null {
  return safeParse(RunSchema, {
    id: row.id,
    taskId: row.task_id,
    date: row.date,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    pausedAt: row.paused_at,
    pausedMs: row.paused_ms,
    movingMs: row.moving_ms,
    distanceM: row.distance_m,
    ascentM: row.ascent_m,
    targetDistanceM: row.target_distance_m,
  });
}

function rowToPoint(row: RunPointRow): RunPoint | null {
  return safeParse(RunPointSchema, {
    runId: row.run_id,
    seq: row.seq,
    lat: row.lat,
    lon: row.lon,
    altitude: row.altitude,
    accuracy: row.accuracy,
    speed: row.speed,
    recordedAt: row.recorded_at,
  });
}

/* ─────────────── Читання ─────────────── */

/** Незавершена пробіжка (active або paused). Гарантовано одна — тримає unique index. */
export async function getLiveRun(): Promise<Run | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RunRow>(
    "SELECT * FROM runs WHERE status IN ('active', 'paused') LIMIT 1",
  );
  return row === null ? null : rowToRun(row);
}

export async function getRunById(id: string): Promise<Run | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RunRow>('SELECT * FROM runs WHERE id = ?', [
    id,
  ]);
  return row === null ? null : rowToRun(row);
}

export async function getRunByTaskId(taskId: string): Promise<Run | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RunRow>(
    'SELECT * FROM runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 1',
    [taskId],
  );
  return row === null ? null : rowToRun(row);
}

export async function getRunsByDate(date: DateString): Promise<Run[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RunRow>(
    'SELECT * FROM runs WHERE date = ? ORDER BY started_at ASC',
    [date],
  );
  return rows.map(rowToRun).filter((r): r is Run => r !== null);
}

export async function getRunsInRange(
  from: DateString,
  to: DateString,
): Promise<Run[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RunRow>(
    "SELECT * FROM runs WHERE date >= ? AND date <= ? AND status = 'finished' ORDER BY date DESC",
    [from, to],
  );
  return rows.map(rowToRun).filter((r): r is Run => r !== null);
}

export type RunTotals = {
  count: number;
  distanceM: number;
  movingMs: number;
  longestM: number;
};

/** Агрегати рахує SQLite, а не JS: на кількох сотнях пробіжок різниця відчутна. */
export async function getRunTotalsInRange(
  from: DateString,
  to: DateString,
): Promise<RunTotals> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    count: number;
    distance_m: number | null;
    moving_ms: number | null;
    longest_m: number | null;
  }>(
    `SELECT COUNT(*) AS count,
            SUM(distance_m) AS distance_m,
            SUM(moving_ms) AS moving_ms,
            MAX(distance_m) AS longest_m
       FROM runs
      WHERE date >= ? AND date <= ? AND status = 'finished'`,
    [from, to],
  );
  return {
    count: row?.count ?? 0,
    distanceM: row?.distance_m ?? 0,
    movingMs: row?.moving_ms ?? 0,
    longestM: row?.longest_m ?? 0,
  };
}

export async function getPoints(runId: string): Promise<RunPoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RunPointRow>(
    'SELECT * FROM run_points WHERE run_id = ? ORDER BY seq ASC',
    [runId],
  );
  return rows.map(rowToPoint).filter((p): p is RunPoint => p !== null);
}

/** Інкрементальне довантаження для живого екрана: тягнемо лише нові точки. */
export async function getPointsAfterSeq(
  runId: string,
  seq: number,
): Promise<RunPoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RunPointRow>(
    'SELECT * FROM run_points WHERE run_id = ? AND seq > ? ORDER BY seq ASC',
    [runId, seq],
  );
  return rows.map(rowToPoint).filter((p): p is RunPoint => p !== null);
}

/* ─────────────── Запис ─────────────── */

export type StartRunInput = {
  taskId: string | null;
  date: DateString;
  targetDistanceM: number | null;
};

/**
 * Створює пробіжку. Якщо незавершена вже є — повертає її, а не створює другу:
 * подвійний тап по «Старт» не має плодити привидів.
 */
export async function startRun(input: StartRunInput): Promise<Run> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();

  let result: Run | null = null;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const existing = await tx.getFirstAsync<RunRow>(
      "SELECT * FROM runs WHERE status IN ('active', 'paused') LIMIT 1",
    );
    if (existing !== null) {
      result = rowToRun(existing);
      return;
    }

    await tx.runAsync(
      `INSERT INTO runs (id, task_id, date, status, started_at, target_distance_m)
       VALUES (?, ?, ?, 'active', ?, ?)`,
      [id, input.taskId, input.date, now, input.targetDistanceM],
    );
    const created = await tx.getFirstAsync<RunRow>(
      'SELECT * FROM runs WHERE id = ?',
      [id],
    );
    result = created === null ? null : rowToRun(created);
  });

  if (result === null) throw new Error('Не вдалося створити пробіжку');
  return result;
}

/**
 * Єдина точка входу для GPS-даних. Викликається і з фореграунду, і з
 * бекграунд-таска, тому вся арифметика — в одній транзакції:
 * читаємо стан → проганяємо через чисті фільтри → пишемо точки й агрегати.
 */
export async function ingestGeoSamples(
  runId: string,
  samples: readonly GeoSample[],
): Promise<{ accepted: number; distanceM: number }> {
  if (samples.length === 0) return { accepted: 0, distanceM: 0 };

  const db = await getDatabase();
  let accepted = 0;
  let distanceM = 0;

  await db.withExclusiveTransactionAsync(async (tx) => {
    const runRow = await tx.getFirstAsync<RunRow>(
      'SELECT * FROM runs WHERE id = ?',
      [runId],
    );
    if (runRow === null) return;

    const run = rowToRun(runRow);
    // Точки, що прилетіли після паузи/фінішу, тихо гинуть тут.
    if (run === null || run.status !== 'active') return;

    const lastRow = await tx.getFirstAsync<RunPointRow>(
      'SELECT * FROM run_points WHERE run_id = ? ORDER BY seq DESC LIMIT 1',
      [runId],
    );
    const lastPoint = lastRow === null ? null : rowToPoint(lastRow);

    const result = ingestSamples(
      accumulatorFromRun(run, lastPoint),
      samples,
    );

    for (const item of result.accepted) {
      await tx.runAsync(
        `INSERT OR IGNORE INTO run_points
           (run_id, seq, lat, lon, altitude, accuracy, speed, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          runId,
          item.seq,
          item.sample.lat,
          item.sample.lon,
          item.sample.altitude,
          item.sample.accuracy,
          item.sample.speed,
          item.sample.recordedAt,
        ],
      );
    }

    await tx.runAsync(
      'UPDATE runs SET distance_m = ?, moving_ms = ?, ascent_m = ? WHERE id = ?',
      [result.acc.distanceM, result.acc.movingMs, result.acc.ascentM, runId],
    );

    accepted = result.accepted.length;
    distanceM = result.acc.distanceM;
  });

  return { accepted, distanceM };
}

export async function pauseRun(runId: string): Promise<Run | null> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE runs SET status = 'paused', paused_at = ? WHERE id = ? AND status = 'active'",
    [Date.now(), runId],
  );
  return getRunById(runId);
}

export async function resumeRun(runId: string): Promise<Run | null> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<RunRow>(
      "SELECT * FROM runs WHERE id = ? AND status = 'paused'",
      [runId],
    );
    if (row === null) return;
    const pausedFor = row.paused_at === null ? 0 : Math.max(0, Date.now() - row.paused_at);
    await tx.runAsync(
      "UPDATE runs SET status = 'active', paused_at = NULL, paused_ms = paused_ms + ? WHERE id = ?",
      [pausedFor, runId],
    );
  });
  return getRunById(runId);
}

export async function finishRun(runId: string): Promise<Run | null> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<RunRow>(
      "SELECT * FROM runs WHERE id = ? AND status IN ('active', 'paused')",
      [runId],
    );
    if (row === null) return;

    const now = Date.now();
    // Хвіст відкритої паузи закриваємо, інакше він назавжди «висів» би в часі.
    const pausedFor = row.paused_at === null ? 0 : Math.max(0, now - row.paused_at);
    await tx.runAsync(
      `UPDATE runs
          SET status = 'finished', ended_at = ?, paused_at = NULL,
              paused_ms = paused_ms + ?
        WHERE id = ?`,
      [now, pausedFor, runId],
    );
  });
  return getRunById(runId);
}

/** Видаляє пробіжку разом з точками (ON DELETE CASCADE). */
export async function deleteRun(runId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM runs WHERE id = ?', [runId]);
  return result.changes > 0;
}
