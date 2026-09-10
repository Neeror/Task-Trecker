import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createTask,
  deleteTask,
  getTasksByDate,
  setTaskDone,
} from '@/storage/tasksRepo';
import { getRunsByDate } from '@/storage/runsRepo';
import { subscribeRunUpdates } from '@/tracking/runEvents';
import type { DateString, NewTaskInput, Run, Task } from '@/types';

type TasksState = {
  tasks: Task[];
  runs: Run[];
  loading: boolean;
  error: string | null;
};

export function useTasks(date: DateString) {
  const [state, setState] = useState<TasksState>({
    tasks: [],
    runs: [],
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [tasks, runs] = await Promise.all([
        getTasksByDate(date),
        getRunsByDate(date),
      ]);
      if (mountedRef.current) {
        setState({ tasks, runs, loading: false, error: null });
      }
    } catch (e) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Не вдалося завантажити задачі',
        }));
        if (__DEV__) console.error('[useTasks] refresh:', e);
      }
    }
  }, [date]);

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }));
    void refresh();
  }, [refresh]);

  // Пробіжка пише в БД із бекграунду — список дня має це бачити одразу.
  useEffect(() => subscribeRunUpdates(() => void refresh()), [refresh]);

  const addTask = useCallback(
    async (input: NewTaskInput): Promise<boolean> => {
      try {
        await createTask(input);
        await refresh();
        return true;
      } catch (e) {
        if (__DEV__) console.error('[useTasks] addTask:', e);
        return false;
      }
    },
    [refresh],
  );

  const toggleTask = useCallback(
    async (id: string): Promise<void> => {
      const current = state.tasks.find((t) => t.id === id);
      if (!current) return;

      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      }));

      const ok = await setTaskDone(id, !current.done).catch(() => false);
      if (!ok) await refresh();
    },
    [state.tasks, refresh],
  );

  const removeTask = useCallback(
    async (id: string): Promise<void> => {
      const previous = state.tasks;
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
      }));

      const ok = await deleteTask(id).catch(() => false);
      if (!ok && mountedRef.current) {
        setState((prev) => ({ ...prev, tasks: previous }));
      }
    },
    [state.tasks],
  );

  const runsByTaskId = useMemo(() => {
    const map = new Map<string, Run>();
    for (const run of state.runs) {
      if (run.taskId !== null) map.set(run.taskId, run);
    }
    return map;
  }, [state.runs]);

  return {
    tasks: state.tasks,
    runsByTaskId,
    loading: state.loading,
    error: state.error,
    refresh,
    addTask,
    toggleTask,
    removeTask,
  };
}
