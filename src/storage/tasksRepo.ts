import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/storage/database';
import {
  NewTaskInputSchema,
  TaskSchema,
  UserTextSchema,
  safeParse,
  type DateString,
  type NewTaskInput,
  type Task,
} from '@/types';

type TaskRow = {
  id: string;
  title: string;
  date: string;
  done: number;
  goal_id: string | null;
  kind: string;
  target_distance_m: number | null;
  created_at: number;
  updated_at: number;
};

const SELECT_COLUMNS =
  'id, title, date, done, goal_id, kind, target_distance_m, created_at, updated_at';

function rowToTask(row: TaskRow): Task | null {
  return safeParse(TaskSchema, {
    id: row.id,
    title: row.title,
    date: row.date,
    done: row.done === 1,
    goalId: row.goal_id,
    kind: row.kind,
    targetDistanceM: row.target_distance_m,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function createTask(input: NewTaskInput): Promise<Task> {
  const parsed = NewTaskInputSchema.parse(input);
  const now = Date.now();
  const task: Task = {
    id: Crypto.randomUUID(),
    title: parsed.title,
    date: parsed.date,
    done: false,
    goalId: parsed.goalId,
    kind: parsed.kind,
    targetDistanceM: parsed.kind === 'run' ? parsed.targetDistanceM : null,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO tasks (id, title, date, done, goal_id, kind, target_distance_m, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.title,
      task.date,
      0,
      task.goalId,
      task.kind,
      task.targetDistanceM,
      task.createdAt,
      task.updatedAt,
    ],
  );
  return task;
}

export async function getTaskById(id: string): Promise<Task | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TaskRow>(
    `SELECT ${SELECT_COLUMNS} FROM tasks WHERE id = ?`,
    [id],
  );
  return row === null ? null : rowToTask(row);
}

export async function getTasksByDate(date: DateString): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT ${SELECT_COLUMNS} FROM tasks WHERE date = ? ORDER BY created_at ASC`,
    [date],
  );
  return rows.map(rowToTask).filter((t): t is Task => t !== null);
}

export async function getTasksInRange(
  from: DateString,
  to: DateString,
): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT ${SELECT_COLUMNS} FROM tasks WHERE date >= ? AND date <= ? ORDER BY date ASC`,
    [from, to],
  );
  return rows.map(rowToTask).filter((t): t is Task => t !== null);
}

export async function setTaskDone(id: string, done: boolean): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'UPDATE tasks SET done = ?, updated_at = ? WHERE id = ?',
    [done ? 1 : 0, Date.now(), id],
  );
  return result.changes > 0;
}

export async function updateTaskTitle(id: string, title: string): Promise<boolean> {
  const validTitle = UserTextSchema.parse(title);
  const db = await getDatabase();
  const result = await db.runAsync(
    'UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?',
    [validTitle, Date.now(), id],
  );
  return result.changes > 0;
}

export async function deleteTask(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
  return result.changes > 0;
}
