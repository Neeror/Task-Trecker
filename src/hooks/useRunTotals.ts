import { useCallback, useEffect, useRef, useState } from 'react';
import { monthRange, yearRange } from '@/logic/dates';
import { getRunTotalsInRange, type RunTotals } from '@/storage/runsRepo';
import type { GoalPeriod } from '@/types';

const EMPTY: RunTotals = { count: 0, distanceM: 0, movingMs: 0, longestM: 0 };

export function useRunTotals(period: GoalPeriod, periodKey: string) {
  const [totals, setTotals] = useState<RunTotals>(EMPTY);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { from, to } =
        period === 'month' ? monthRange(periodKey) : yearRange(periodKey);
      const result = await getRunTotalsInRange(from, to);
      if (mountedRef.current) setTotals(result);
    } catch (e) {
      if (__DEV__) console.error('[useRunTotals] refresh:', e);
    }
  }, [period, periodKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { totals, refresh };
}
