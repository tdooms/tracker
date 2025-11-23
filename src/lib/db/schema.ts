import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// Activity log from Python tracker
export const activityLog = sqliteTable('activity_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(), // ISO format
  appName: text('app_name').notNull(),
  windowTitle: text('window_title').notNull(),
  duration: integer('duration').notNull(), // seconds
  createdAt: text('created_at'),
});

// Input metrics from Python tracker
export const inputMetrics = sqliteTable('input_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(), // ISO format
  keyPresses: integer('key_presses').notNull(),
  mouseClicks: integer('mouse_clicks').notNull(),
  mouseDistance: integer('mouse_distance').notNull(), // pixels
  createdAt: text('created_at'),
});

// Idle periods from Python tracker
export const idlePeriods = sqliteTable('idle_periods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startTime: text('start_time').notNull(), // ISO format
  endTime: text('end_time'), // nullable until idle ends
  duration: integer('duration'), // seconds, nullable until idle ends
  createdAt: text('created_at'),
});
