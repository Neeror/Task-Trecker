import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/storage/database';
import {
  GoalStepSchema,
  NewGoalStepInputSchema,
  safeParse,
  type GoalPeriod,
  type GoalStep,
  type NewGoalStepInput,
} from '@/types';

type GoalStepRow = {
  id: string;
  goal_id: string;
  title: string;
  done: number;
  created_at: number;
};

function rowToStep(row: GoalStepRow): GoalStep | null {
  return safeParse(GoalStepSchema, {
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    done: row.done === 1,
    createdAt: row.created_at,
  });
}

export async function createGoalStep(input: NewGoalStepInput): Promise<GoalStep> {
  const parsed = NewGoalStepInputSchema.parse(input);
  const step: GoalStep = {
    id: Crypto.randomUUID(),
    goalId: parsed.goalId,
    title: parsed.title,
    done: false,
    createdAt: Date.now(),
  };

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO goal_steps (id, goal_id, title, done, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [step.id, step.goalId, step.title, step.done ? 1 : 0, step.createdAt],
  );
  return step;
}

export async function getStepsByGoal(goalId: string): Promise<GoalStep[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GoalStepRow>(
    'SELECT * FROM goal_steps WHERE goal_id = ? ORDER BY created_at ASC',
    [goalId],
  );
  return rows.map(rowToStep).filter((s): s is GoalStep => s !== null);
}

export async function getStepsByPeriod(
  period: GoalPeriod,
  periodKey: string,
): Promise<GoalStep[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GoalStepRow>(
    `SELECT gs.* FROM goal_steps gs
     INNER JOIN goals g ON g.id = gs.goal_id
     WHERE g.period = ? AND g.period_key = ?
     ORDER BY gs.created_at ASC`,
    [period, periodKey],
  );
  return rows.map(rowToStep).filter((s): s is GoalStep => s !== null);
}

export async function setGoalStepDone(
  id: string,
  done: boolean,
): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'UPDATE goal_steps SET done = ? WHERE id = ?',
    [done ? 1 : 0, id],
  );
  return result.changes > 0;
}

export async function deleteGoalStep(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM goal_steps WHERE id = ?', [id]);
  return result.changes > 0;
}