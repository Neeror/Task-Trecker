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
import { ensureRunPermissions } from '@/tracking/permissions';
import {
  isTrackingActive,
  startRunUpdates,
  stopRunUpdates,
} from '@/tracking/locationTask';
import type { Run } from '@/types';

export type BeginRunResult =
  | { ok: true; run: Run; backgroundGranted: boolean }
  | { ok: false; reason: string };

export type BeginRunInput = {
  taskId: string | null;
  targetDistanceM: number | null;
};

/**
 * Порядок важливий: спершу дозволи, потім запис у БД, і лише потім GPS.
 * Інакше в базі з'явиться «активна» пробіжка, яку ніхто не пише.
 */
export async function beginRun(input: BeginRunInput): Promise<BeginRunResult> {
  const live = await getLiveRun();
  if (live !== null) {
    await syncTracking();
    return { ok: true, run: live, backgroundGranted: true };
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
    await startRunUpdates();
  } catch (e) {
    if (__DEV__) console.error('[runController] startUpdates:', e);
    await finishRun(run.id);
    return { ok: false, reason: 'Не вдалося запустити GPS. Спробуй ще раз' };
  }

  emitRunUpdated();
  return { ok: true, run, backgroundGranted: permission.background };
}

export async function pauseCurrentRun(runId: string): Promise<Run | null> {
  // Спершу глушимо GPS: точки, що прилетять після, однаково відкине repo.
  await stopRunUpdates();
  const run = await pauseRun(runId);
  emitRunUpdated();
  return run;
}

export async function resumeCurrentRun(runId: string): Promise<Run | null> {
  const run = await resumeRun(runId);
  if (run?.status === 'active') await startRunUpdates();
  emitRunUpdated();
  return run;
}

export type FinishOutcome = { run: Run | null; taskCompleted: boolean };

export async function finishCurrentRun(runId: string): Promise<FinishOutcome> {
  await stopRunUpdates();
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
 * джерелом істини лишається база.
 */
export async function syncTracking(): Promise<void> {
  try {
    const run = await getLiveRun();
    const tracking = await isTrackingActive();

    if (run?.status === 'active' && !tracking) {
      await startRunUpdates();
      return;
    }
    if ((run === null || run.status !== 'active') && tracking) {
      await stopRunUpdates();
    }
  } catch (e) {
    if (__DEV__) console.error('[runController] syncTracking:', e);
  }
}
