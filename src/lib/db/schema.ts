import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

// APM (Activity Performance Metrics) tracking table
export const apmLogs = sqliteTable('apm_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  keysPerMinute: real('keys_per_minute').notNull(),
  mouseClicks: integer('mouse_clicks').notNull(),
  mouseDistance: real('mouse_distance'), // pixels moved
  activeWindow: text('active_window'),
});

// Git metrics tracking table
export const gitMetrics = sqliteTable('git_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  repository: text('repository').notNull(),
  commitHash: text('commit_hash'),
  linesAdded: integer('lines_added').notNull(),
  linesDeleted: integer('lines_deleted').notNull(),
  filesChanged: integer('files_changed').notNull(),
  commitMessage: text('commit_message'),
});

// Custom activity sessions table
export const activitySessions = sqliteTable('activity_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
  category: text('category').notNull(), // 'productive', 'neutral', 'idle'
  description: text('description'),
});
