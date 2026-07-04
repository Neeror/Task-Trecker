import { getDatabase } from '@/storage/database';
import { DailySummarySchema, safeParse, type DailySummary, type DateString } from '@/types';
import { buildDailySummary } from '@/logic/progress';
import { getTasksByDate } from '@/storage/tasksRepo';

type SummaryRow = {
  date: string;
  total_tasks: number;
  done_tasks: number;
  percent: number;
  closed_at: number;
};

function rowToSummary(row: SummaryRow): DailySummary | null {
  return safeParse(DailySummarySchema, {
    date: row.date,
    totalTasks: row.total_tasks,
    doneTasks: row.done_tasks,
    percent: row.percent,
    closedAt: row.closed_at,
  });
}

export async function closeDay(date: DateString): Promise<DailySummary> {
  const tasks = await getTasksByDate(date);
  const summary: DailySummary = DailySummarySchema.parse({
    ...buildDailySummary(date, tasks),
    closedAt: Date.now(),
  });

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO daily_summaries (date, total_tasks, done_tasks, percent, closed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (date) DO UPDATE SET
       total_tasks = excluded.total_tasks,
       done_tasks = excluded.done_tasks,
       percent = excluded.percent,
       closed_at = excluded.closed_at`,
    [summary.date, summary.totalTasks, summary.doneTasks, summary.percent, summary.closedAt],
  );
  return summary;
}

export async function getSummary(date: DateString): Promise<DailySummary | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SummaryRow>(
    'SELECT * FROM daily_summaries WHERE date = ?',
    [date],
  );
  return row ? rowToSummary(row) : null;
}

export async function getSummariesInRange(
  from: DateString,
  to: DateString,
): Promise<DailySummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SummaryRow>(
    'SELECT * FROM daily_summaries WHERE date >= ? AND date <= ? ORDER BY date ASC',
    [from, to],
  );
  return rows.map(rowToSummary).filter((s): s is DailySummary => s !== null);
}
