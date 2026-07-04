import type { DailySummary, DateString, Goal, Task } from '@/types';

export type ProgressResult = {
  total: number;
  done: number;
  percent: number;
};

export type GoalProgressResult = {
  goal: Goal;
  done: number;
  target: number;
  percent: number;
  status: 'underachieved' | 'achieved' | 'overachieved';
};

export function calcPercent(done: number, total: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(total)) return 0;
  if (total <= 0 || done <= 0) return 0;
  return Math.round((Math.min(done, total) / total) * 100);
}

export function calcProgress(tasks: readonly Task[]): ProgressResult {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { total, done, percent: calcPercent(done, total) };
}

export function calcProgressInRange(
  tasks: readonly Task[],
  from: DateString,
  to: DateString,
): ProgressResult {
  const inRange = tasks.filter((t) => t.date >= from && t.date <= to);
  return calcProgress(inRange);
}

export function buildDailySummary(
  date: DateString,
  tasks: readonly Task[],
): Omit<DailySummary, 'closedAt'> {
  const dayTasks = tasks.filter((t) => t.date === date);
  const { total, done, percent } = calcProgress(dayTasks);
  return { date, totalTasks: total, doneTasks: done, percent };
}

export function calcGoalProgress(
  goal: Goal,
  tasks: readonly Task[],
): GoalProgressResult {
  const done = tasks.filter((t) => t.goalId === goal.id && t.done).length;
  const target = goal.targetCount;
  const rawPercent =
    target > 0 ? Math.round((done / target) * 100) : 0;

  let status: GoalProgressResult['status'];
  if (rawPercent < 100) status = 'underachieved';
  else if (rawPercent === 100) status = 'achieved';
  else status = 'overachieved';

  return { goal, done, target, percent: rawPercent, status };
}

export function averagePercent(
  summaries: readonly DailySummary[],
): number {
  if (summaries.length === 0) return 0;
  const sum = summaries.reduce((acc, s) => acc + s.percent, 0);
  return Math.round(sum / summaries.length);
}
