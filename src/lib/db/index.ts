import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Path to ActivityWatch database (Windows path)
const activityWatchDbPath = join(
  homedir(),
  'AppData',
  'Local',
  'activitywatch',
  'activitywatch',
  'aw-server',
  'peewee-sqlite.v2.db'
);

// Path to custom metrics database
const customMetricsDbPath = join(process.cwd(), 'data', 'metrics.db');

// ActivityWatch database connection (read-only)
let awDb: Database.Database;
let awDrizzle: ReturnType<typeof drizzle>;

export function getActivityWatchDb() {
  if (!awDb) {
    try {
      awDb = new Database(activityWatchDbPath, { readonly: true });
      awDrizzle = drizzle(awDb);
    } catch (error) {
      console.error('Failed to connect to ActivityWatch database:', error);
      throw new Error(
        `ActivityWatch database not found at ${activityWatchDbPath}`
      );
    }
  }
  return { db: awDb, drizzle: awDrizzle };
}

// Custom metrics database connection
let metricsDb: Database.Database;
let metricsDrizzle: ReturnType<typeof drizzle<typeof schema>>;

export function getMetricsDb() {
  if (!metricsDb) {
    // Ensure data directory exists
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    metricsDb = new Database(customMetricsDbPath);
    metricsDrizzle = drizzle(metricsDb, { schema });

    // Initialize schema if tables don't exist
    initializeMetricsDb();
  }
  return { db: metricsDb, drizzle: metricsDrizzle };
}

function initializeMetricsDb() {
  // Create tables if they don't exist
  metricsDb.exec(`
    CREATE TABLE IF NOT EXISTS apm_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      keys_per_minute REAL NOT NULL,
      mouse_clicks INTEGER NOT NULL,
      mouse_distance REAL,
      active_window TEXT
    );

    CREATE TABLE IF NOT EXISTS git_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      repository TEXT NOT NULL,
      commit_hash TEXT,
      lines_added INTEGER NOT NULL,
      lines_deleted INTEGER NOT NULL,
      files_changed INTEGER NOT NULL,
      commit_message TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT
    );
  `);
}

// Helper to close connections (useful for cleanup in tests)
export function closeConnections() {
  if (awDb) awDb.close();
  if (metricsDb) metricsDb.close();
}
