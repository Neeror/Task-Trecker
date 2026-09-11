import { AppState } from 'react-native';
import { today } from '@/logic/dates';
import { isRunGoalMet } from '@/logic/runMetrics';
import {
  finishRun,
  getLiveRun,
  pauseRun,
  resumeRun,
  startRun,
} from '@/storage/runsRepo';
import { setTaskDone } from '@/storage/tasksRepo';
import { emitRunUpdated } from '@/tracking/runEvents';
import {
  ensureRunPermissions,
  hasBackgroundPermission,
} from '@/tracking/permissions';
import {
  isForegroundServiceBlocked,
  markForegroundServiceAttempt,
} from '@/tracking/fgsGuard';
import {
  isForegroundTrackingActive,
  startForegroundTracking,
  stopForegroundTracking,
} from '@/tracking/foregroundTracker';
import {
  isTrackingActive,
  startRunUpdates,
  stopRunUpdates,
} from '@/tracking/locationTask';
import type { Run } from '@/types';

/** background — пишемо із згаслим екраном; foreground — лише поки апка відкрита. */
export type TrackingMode = 'background' | 'foreground' | 'off';

export type BeginRunResult =
  | { ok: true; run: Run; backgroundGranted: boolean }
  | { ok: false; reason: string };

export type BeginRunInput = {
  taskId: string | null;
  targetDistanceM: number | null;
};

let mode: TrackingMode = 'off';

export function getTrackingMode(): TrackingMode {
  return mode;
}

/**
 * Єдиний вхід для GPS.
 *
 * Ключове правило: background-таск із foregroundService піднімаємо ТІЛЬКИ якщо
 * є дозвіл «Завжди» І апка справді у foreground. Android 14+ перевіряє право на
 * FGS у момент startForeground(), а expo-location викликає його асинхронно, вже
 * після резолву промісу — виняток звідти летить на main looper і вбиває процес
 * без шансу зловити його з JS. Немає умов → пишемо трек watchPositionAsync,
 * апка залишається жива, метрики ті самі.
 */
async function startTracking(): Promise<TrackingMode> {
  // Служба вже крутиться (ОС підняла апку в бекграунді) — нічого не чіпаємо.
  if (await isTrackingActive()) {
    await stopForegroundTracking();
    mode = 'background';
    return mode;
  }

  // Уже пишемо у foreground-режимі: не смикаємо FGS на кожному ресюмі.
  if (isForegroundTrackingActive()) {
    mode = 'foreground';
    return mode;
  }

  const canUseService =
    (await hasBackgroundPermission()) &&
    AppState.currentState === 'active' &&
    !(await isForegroundServiceBlocked());

  if (canUseService) {
    try {
      await markForegroundServiceAttempt();
      await startRunUpdates();
      mode = 'background';
      return mode;
    } catch (e) {
      // Ловимий випадок (напр. апка встигла піти у фон) — не привід падати.
      if (__DEV__) console.error('[runController] startRunUpdates:', e);
    }
  }

  // Напівживий таск гірший за жодний: він тримає задушений background-запит.
  await stopRunUpdates();
  await startForegroundTracking();
  mode = 'foreground';
  return mode;
}

async function stopTracking(): Promise<void> {
  await stopForegroundTracking();
  await stopRunUpdates();
  mode = 'off';
}

/**
 * Порядок важливий: спершу дозволи, потім запис у БД, і лише потім GPS.
 * Інакше в базі з'явиться «активна» пробіжка, яку ніхто не пише.
 */
export async function beginRun(input: BeginRunInput): Promise<BeginRunResult> {
  const live = await getLiveRun();
  if (live !== null) {
    const resumed = await syncTracking();
    return { ok: true, run: live, backgroundGranted: resumed === 'background' };
  }

  const permission = await ensureRunPermissions();
  if (!permission.ok) {
    return {
      ok: false,
      reason:
        permission.reason === 'foreground-denied'
          ? 'Без доступу до геолокації трекер не запишe маршрут'
          : 'Увімкни геолокацію та спробуй ще раз',
    };
  }

  const run = await startRun({
    taskId: input.taskId,
    date: today(),
    targetDistanceM: input.targetDistanceM,
  });

  try {
    const started = await startTracking();
    if (started === 'off') throw new Error('tracking did not start');
    emitRunUpdated();
    return { ok: true, run, backgroundGranted: started === 'background' };
  } catch (e) {
    if (__DEV__) console.error('[runController] startTracking:', e);
    await finishRun(run.id);
    emitRunUpdated();
    return { ok: false, reason: 'Не вдалося запустити GPS. Спробуй ще раз' };
  }
}

export async function pauseCurrentRun(runId: string): Promise<Run | null> {
  // Спершу глушимо GPS: точки, що прилетять після, однаково відкине repo.
  await stopTracking();
  const run = await pauseRun(runId);
  emitRunUpdated();
  return run;
}

export async function resumeCurrentRun(runId: string): Promise<Run | null> {
  const run = await resumeRun(runId);
  if (run?.status === 'active') await startTracking();
  emitRunUpdated();
  return run;
}

export type FinishOutcome = { run: Run | null; taskCompleted: boolean };

export async function finishCurrentRun(runId: string): Promise<FinishOutcome> {
  await stopTracking();
  const run = await finishRun(runId);

  let taskCompleted = false;
  if (run !== null && run.taskId !== null && isRunGoalMet(run)) {
    taskCompleted = await setTaskDone(run.taskId, true);
  }

  emitRunUpdated();
  return { run, taskCompleted };
}

/**
 * Приводить GPS у відповідність до БД. Викликається на монтуванні екрана і на
 * поверненні апки з бекграунду: ОС може прибити foreground service, а
 * джерелом істини лишається база. Повертає режим, щоб екран міг сказати юзеру
 * правду про те, чи виживе трек із згаслим екраном.
 */
export async function syncTracking(): Promise<TrackingMode> {
  try {
    const run = await getLiveRun();
    if (run?.status === 'active') return await startTracking();
    await stopTracking();
    return 'off';
  } catch (e) {
    if (__DEV__) console.error('[runController] syncTracking:', e);
    return mode;
  }
}
