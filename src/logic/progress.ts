import type { DailySummary, DateString, Goal, GoalStep, Task } from '@/types';

export type ProgressResult = {
  total: number;
  done: number;
  percent: number;
};

export type GoalProgressSource = 'steps' | 'manual' | 'tasks';

export type GoalProgressResult = {
  goal: Goal;
  done: number;
  target: number;
  percent: number;
  status: 'underachieved' | 'achieved' | 'overachieved';
  source: GoalProgressSource;
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

function percentToStatus(percent: number): GoalProgressResult['status'] {
  if (percent < 100) return 'underachieved';
  if (percent === 100) return 'achieved';
  return 'overachieved';
}

export function calcGoalProgress(
  goal: Goal,
  tasks: readonly Task[],
  steps: readonly GoalStep[] = [],
): GoalProgressResult {
  const goalSteps = steps.filter((s) => s.goalId === goal.id);

  // 1. Якщо є підцілі — прогрес рахується за ними
  if (goalSteps.length > 0) {
    const done = goalSteps.filter((s) => s.done).length;
    const target = goalSteps.length;
    const percent = Math.round((done / target) * 100);
    return {
      goal,
      done,
      target,
      percent,
      status: percentToStatus(percent),
      source: 'steps',
    };
  }

  // 2. Якщо вручну поставлено відсоток — використовуємо його
  if (goal.manualPercent !== null) {
    const percent = goal.manualPercent;
    return {
      goal,
      done: Math.round((percent / 100) * goal.targetCount),
      target: goal.targetCount,
      percent,
      status: percentToStatus(percent),
      source: 'manual',
    };
  }

  // 3. Інакше — за прив'язаними задачами (стара логіка)
  const done = tasks.filter((t) => t.goalId === goal.id && t.done).length;
  const target = goal.targetCount;
  const rawPercent = target > 0 ? Math.round((done / target) * 100) : 0;

  return {
    goal,
    done,
    target,
    percent: rawPercent,
    status: percentToStatus(rawPercent),
    source: 'tasks',
  };
}


export function averagePercent(
  summaries: readonly DailySummary[],
): number {
  if (summaries.length === 0) return 0;
  const sum = summaries.reduce((acc, s) => acc + s.percent, 0);
  return Math.round(sum / summaries.length);
}
