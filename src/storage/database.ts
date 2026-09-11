import * as SQLite from 'expo-sqlite';

const DB_NAME = 'tasktracker.db';
const SCHEMA_VERSION = 3;

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

    if (currentVersion < 2) {
      // Пробіжка — це не окрема сутність поруч із задачами, а ЇХ ПІДТИП.
      // Тому 'kind' живе в tasks: увесь наявний код прогресу, цілей і
      // підсумків дня продовжує працювати без жодної зміни.
      //
      // Свідомо без CHECK у ALTER TABLE: поведінка CHECK в ADD COLUMN
      // залежить від версії SQLite на девайсі, а зламана міграція = зламана
      // апка. Інваріант тримає zod у шарі types + repo.
      const taskColumns = await tx.getAllAsync<{ name: string }>(
        "SELECT name FROM pragma_table_info('tasks')",
      );
      const hasColumn = (name: string): boolean =>
        taskColumns.some((c) => c.name === name);

      if (!hasColumn('kind')) {
        await tx.execAsync(
          "ALTER TABLE tasks ADD COLUMN kind TEXT NOT NULL DEFAULT 'task'",
        );
      }
      if (!hasColumn('target_distance_m')) {
        await tx.execAsync(
          'ALTER TABLE tasks ADD COLUMN target_distance_m REAL',
        );
      }

      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT,
          date TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'finished')),
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          paused_at INTEGER,
          paused_ms INTEGER NOT NULL DEFAULT 0 CHECK (paused_ms >= 0),
          moving_ms INTEGER NOT NULL DEFAULT 0 CHECK (moving_ms >= 0),
          distance_m REAL NOT NULL DEFAULT 0 CHECK (distance_m >= 0),
          ascent_m REAL NOT NULL DEFAULT 0 CHECK (ascent_m >= 0),
          target_distance_m REAL,
          CHECK (ended_at IS NULL OR ended_at >= started_at),
          FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE SET NULL
        );

        -- Сирі точки, а не лише підсумок: метрики завжди можна перерахувати
        -- новою (кращою) формулою, а маршрут — намалювати.
        CREATE TABLE IF NOT EXISTS run_points (
          run_id TEXT NOT NULL,
          seq INTEGER NOT NULL,
          lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
          lon REAL NOT NULL CHECK (lon BETWEEN -180 AND 180),
          altitude REAL,
          accuracy REAL,
          speed REAL,
          recorded_at INTEGER NOT NULL,
          PRIMARY KEY (run_id, seq),
          FOREIGN KEY (run_id) REFERENCES runs (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_runs_date ON runs (date);
        CREATE INDEX IF NOT EXISTS idx_runs_task ON runs (task_id);
        CREATE INDEX IF NOT EXISTS idx_run_points_time
          ON run_points (run_id, recorded_at);

        -- Головний інваріант фічі, на рівні БД: жодного разу не може бути
        -- двох незавершених пробіжок одночасно.
        CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_single_live
          ON runs (status) WHERE status IN ('active', 'paused');
      `);
    }
    if (currentVersion < 3) {
  const goalColumns = await tx.getAllAsync<{ name: string }>(
    "SELECT name FROM pragma_table_info('goals')",
  );
  if (!goalColumns.some((c) => c.name === 'manual_percent')) {
    await tx.execAsync('ALTER TABLE goals ADD COLUMN manual_percent INTEGER');
  }

  await tx.execAsync(`
    CREATE TABLE IF NOT EXISTS goal_steps (
      id TEXT PRIMARY KEY NOT NULL,
      goal_id TEXT NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
      created_at INTEGER NOT NULL,
      FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_goal_steps_goal ON goal_steps (goal_id);
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
