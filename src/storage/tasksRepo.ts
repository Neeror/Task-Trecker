import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/storage/database';
import {
  NewTaskInputSchema,
  TaskSchema,
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
  created_at: number;
  updated_at: number;
};

function rowToTask(row: TaskRow): Task | null {
  return safeParse(TaskSchema, {
    id: row.id,
    title: row.title,
    date: row.date,
    done: row.done === 1,
    goalId: row.goal_id,
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
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO tasks (id, title, date, done, goal_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [task.id, task.title, task.date, 0, task.goalId, task.createdAt, task.updatedAt],
  );
  return task;
}

export async function getTasksByDate(date: DateString): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TaskRow>(
    'SELECT * FROM tasks WHERE date = ? ORDER BY created_at ASC',
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
    'SELECT * FROM tasks WHERE date >= ? AND date <= ? ORDER BY date ASC',
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
  const validTitle = TaskSchema.shape.title.parse(title);
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
