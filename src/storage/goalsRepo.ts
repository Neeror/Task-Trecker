import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/storage/database';
import {
  GoalSchema,
  NewGoalInputSchema,
  safeParse,
  type Goal,
  type GoalPeriod,
  type NewGoalInput,
} from '@/types';

type GoalRow = {
  id: string;
  title: string;
  period: string;
  period_key: string;
  target_count: number;
  manual_percent: number | null;
  created_at: number;
};

function rowToGoal(row: GoalRow): Goal | null {
  return safeParse(GoalSchema, {
    id: row.id,
    title: row.title,
    period: row.period,
    periodKey: row.period_key,
    targetCount: row.target_count,
    manualPercent: row.manual_percent ?? null,
    createdAt: row.created_at,
  });
}


export async function createGoal(input: NewGoalInput): Promise<Goal> {
  const parsed = NewGoalInputSchema.parse(input);
    const goal: Goal = {
    id: Crypto.randomUUID(),
    title: parsed.title,
    period: parsed.period,
    periodKey: parsed.periodKey,
    targetCount: parsed.targetCount,
    manualPercent: null,
    createdAt: Date.now(),
  };

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO goals (id, title, period, period_key, target_count, manual_percent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [goal.id, goal.title, goal.period, goal.periodKey, goal.targetCount, goal.manualPercent, goal.createdAt],
  );
  return goal;
}

export async function setGoalManualPercent(
  id: string,
  percent: number | null,
): Promise<boolean> {
  if (
    percent !== null &&
    (!Number.isInteger(percent) || percent < 0 || percent > 100)
  ) {
    return false;
  }
  const db = await getDatabase();
  const result = await db.runAsync(
    'UPDATE goals SET manual_percent = ? WHERE id = ?',
    [percent, id],
  );
  return result.changes > 0;
}

export async function getGoalsByPeriod(
  period: GoalPeriod,
  periodKey: string,
): Promise<Goal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GoalRow>(
    'SELECT * FROM goals WHERE period = ? AND period_key = ? ORDER BY created_at ASC',
    [period, periodKey],
  );
  return rows.map(rowToGoal).filter((g): g is Goal => g !== null);
}

export async function getAllGoals(): Promise<Goal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GoalRow>(
    'SELECT * FROM goals ORDER BY created_at DESC',
  );
  return rows.map(rowToGoal).filter((g): g is Goal => g !== null);
}

export async function deleteGoal(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
  return result.changes > 0;
}
