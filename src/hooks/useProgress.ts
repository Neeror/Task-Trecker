import { useCallback, useEffect, useRef, useState } from 'react';
import { monthRange, yearRange } from '@/logic/dates';
import {
  averagePercent,
  calcGoalProgress,
  calcProgress,
  type GoalProgressResult,
  type ProgressResult,
} from '@/logic/progress';
import { getGoalsByPeriod } from '@/storage/goalsRepo';
import { getSummariesInRange } from '@/storage/summariesRepo';
import { getTasksInRange } from '@/storage/tasksRepo';
import type { GoalPeriod } from '@/types';

type PeriodProgressState = {
  progress: ProgressResult;
  avgDailyPercent: number;
  goals: GoalProgressResult[];
  loading: boolean;
  error: string | null;
};

const initialState: PeriodProgressState = {
  progress: { total: 0, done: 0, percent: 0 },
  avgDailyPercent: 0,
  goals: [],
  loading: true,
  error: null,
};

export function usePeriodProgress(period: GoalPeriod, periodKey: string) {
  const [state, setState] = useState<PeriodProgressState>(initialState);
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

      const [tasks, summaries, goals] = await Promise.all([
        getTasksInRange(from, to),
        getSummariesInRange(from, to),
        getGoalsByPeriod(period, periodKey),
      ]);

      if (!mountedRef.current) return;

      setState({
        progress: calcProgress(tasks),
        avgDailyPercent: averagePercent(summaries),
        goals: goals.map((goal) => calcGoalProgress(goal, tasks)),
        loading: false,
        error: null,
      });
    } catch (e) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Не вдалося завантажити статистику',
        }));
        if (__DEV__) console.error('[usePeriodProgress] refresh:', e);
      }
    }
  }, [period, periodKey]);

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }));
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
