import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { paceMsPerKm } from '@/logic/geo';
import { elapsedMs, isRunGoalMet, remainingM } from '@/logic/runMetrics';
import { getLiveRun, getPointsAfterSeq } from '@/storage/runsRepo';
import { subscribeRunUpdates } from '@/tracking/runEvents';
import type { Run, RunPoint } from '@/types';

const DB_POLL_MS = 2000;
const CLOCK_TICK_MS = 1000;

/**
 * Живий стан пробіжки. Джерело істини — SQLite, а не пам'ять компонента:
 * після краху апки або перезапуску процесу екран відновиться сам.
 */
export function useLiveRun() {
  const [run, setRun] = useState<Run | null>(null);
  const [points, setPoints] = useState<RunPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(() => Date.now());

  const lastSeqRef = useRef(-1);
  const mountedRef = useRef(true);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const live = await getLiveRun();
      if (!mountedRef.current) return;

      if (live === null) {
        runIdRef.current = null;
        lastSeqRef.current = -1;
        setRun(null);
        setPoints([]);
        setLoading(false);
        return;
      }

      // Змінилась пробіжка — скидаємо інкрементальний курсор.
      if (runIdRef.current !== live.id) {
        runIdRef.current = live.id;
        lastSeqRef.current = -1;
        setPoints([]);
      }

      const fresh = await getPointsAfterSeq(live.id, lastSeqRef.current);
      if (!mountedRef.current) return;

      if (fresh.length > 0) {
        const lastPoint = fresh[fresh.length - 1];
        if (lastPoint !== undefined) lastSeqRef.current = lastPoint.seq;
        setPoints((prev) => [...prev, ...fresh]);
      }
      setRun(live);
      setLoading(false);
    } catch (e) {
      if (__DEV__) console.error('[useLiveRun] refresh:', e);
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), DB_POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    const unsubscribe = subscribeRunUpdates(() => void refresh());
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      unsubscribe();
    };
  }, [refresh]);

  const derived = useMemo(() => {
    if (run === null) {
      return {
        elapsed: 0,
        pace: 0,
        distanceM: 0,
        remaining: 0,
        goalMet: false,
      };
    }
    const elapsed = elapsedMs(run, now);
    return {
      elapsed,
      // Темп по часу «в руху»: стояння на світлофорі не має псувати цифру.
      pace: paceMsPerKm(run.distanceM, run.movingMs > 0 ? run.movingMs : elapsed),
      distanceM: run.distanceM,
      remaining: remainingM(run),
      goalMet: isRunGoalMet(run) && run.targetDistanceM !== null,
    };
  }, [run, now]);

  return { run, points, loading, refresh, ...derived };
}
