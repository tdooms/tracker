import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

// Path to Python tracker database
const trackerDbPath = join(
  homedir(),
  'Documents',
  'activity-tracker',
  'tracker.db'
);

// Tracker database connection (read-only)
let trackerDb: Database.Database;
let trackerDrizzle: ReturnType<typeof drizzle>;

export function getTrackerDb() {
  if (!trackerDb) {
    try {
      trackerDb = new Database(trackerDbPath, { readonly: true });
      trackerDrizzle = drizzle(trackerDb);
    } catch (error) {
      console.error('Failed to connect to tracker database:', error);
      throw new Error(
        `Tracker database not found at ${trackerDbPath}. Make sure the Python tracker is running.`
      );
    }
  }
  return { db: trackerDb, drizzle: trackerDrizzle };
}

// Helper to close connections (useful for cleanup in tests)
export function closeConnections() {
  if (trackerDb) trackerDb.close();
}
