import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { paceMsPerKm } from '@/logic/geo';
import { computeSplits, elapsedMs } from '@/logic/runMetrics';
import { getPoints, getRunById } from '@/storage/runsRepo';
import { getTaskById } from '@/storage/tasksRepo';
import type { Run, RunPoint } from '@/types';

type State = {
  run: Run | null;
  points: RunPoint[];
  title: string | null;
  loading: boolean;
  error: string | null;
};

const initialState: State = {
  run: null,
  points: [],
  title: null,
  loading: true,
  error: null,
};

export function useRunDetail(runId: string) {
  const [state, setState] = useState<State>(initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const run = await getRunById(runId);
      if (run === null) {
        if (mountedRef.current) {
          setState({ ...initialState, loading: false, error: 'Пробіжку не знайдено' });
        }
        return;
      }
      const [points, task] = await Promise.all([
        getPoints(runId),
        run.taskId === null ? Promise.resolve(null) : getTaskById(run.taskId),
      ]);
      if (!mountedRef.current) return;
      setState({
        run,
        points,
        title: task?.title ?? null,
        loading: false,
        error: null,
      });
    } catch (e) {
      if (__DEV__) console.error('[useRunDetail] load:', e);
      if (mountedRef.current) {
        setState({ ...initialState, loading: false, error: 'Не вдалося відкрити пробіжку' });
      }
    }
  }, [runId]);

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }));
    void load();
  }, [load]);

  const derived = useMemo(() => {
    const { run, points } = state;
    if (run === null) {
      return { splits: [], elapsed: 0, pace: 0 };
    }
    const elapsed = elapsedMs(run, run.endedAt ?? Date.now());
    return {
      splits: computeSplits(points),
      elapsed,
      pace: paceMsPerKm(run.distanceM, run.movingMs > 0 ? run.movingMs : elapsed),
    };
  }, [state]);

  return { ...state, ...derived, reload: load };
}
