import * as SQLite from 'expo-sqlite';

const DB_NAME = 'tasktracker.db';
const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) return;

  await db.withExclusiveTransactionAsync(async (tx) => {
    if (currentVersion < 1) {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          date TEXT NOT NULL,
          done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
          goal_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS goals (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          period TEXT NOT NULL CHECK (period IN ('month', 'year')),
          period_key TEXT NOT NULL,
          target_count INTEGER NOT NULL CHECK (target_count > 0),
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_summaries (
          date TEXT PRIMARY KEY NOT NULL,
          total_tasks INTEGER NOT NULL CHECK (total_tasks >= 0),
          done_tasks INTEGER NOT NULL CHECK (done_tasks >= 0),
          percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
          closed_at INTEGER NOT NULL,
          CHECK (done_tasks <= total_tasks)
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks (date);
        CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks (goal_id);
        CREATE INDEX IF NOT EXISTS idx_goals_period ON goals (period, period_key);
      `);
    }
    await tx.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise === null) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL');
      await db.execAsync('PRAGMA foreign_keys = ON');
      await migrate(db);
      return db;
    })().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}
