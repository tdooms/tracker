import { getActivityWatchDb, getMetricsDb } from './index';
import { sql } from 'drizzle-orm';
import { apmLogs } from './schema';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export interface HourlyActivity {
  hour: string;
  appName: string;
  duration: number; // seconds
}

export interface DailyActivity {
  date: string;
  totalActive: number; // seconds
  productive: number; // seconds
  category: 'productive' | 'neutral' | 'idle';
}

export interface ActivityStats {
  totalActiveTime: number; // seconds
  topApps: { name: string; duration: number }[];
  avgSessionLength: number; // seconds
  sessionsToday: number;
}

export interface APMMetric {
  timestamp: Date;
  keysPerMinute: number;
  mouseClicks: number;
  mouseDistance?: number;
}

export interface WebsiteActivity {
  website: string;
  duration: number; // seconds
}

/**
 * Get hourly activity data from ActivityWatch
 * Returns application usage grouped by hour for the last 7 days
 * CORRECTLY handles events that span across hour boundaries by splitting them
 */
export async function getHourlyActivity(
  daysBack: number = 7
): Promise<HourlyActivity[]> {
  const { db } = getActivityWatchDb();

  // Use recursive CTE to split events that cross hour boundaries
  const query = `
    WITH RECURSIVE hour_splits AS (
      -- Base case: get the first hour of each event
      SELECT
        json_extract(datastr, '$.app') as app_name,
        strftime('%Y-%m-%d %H:00', timestamp) as hour,
        timestamp as event_start,
        datetime(timestamp, '+' || duration || ' seconds') as event_end,
        duration,
        -- Calculate duration for first hour segment
        CAST((julianday(MIN(
          datetime(timestamp, '+' || duration || ' seconds'),
          datetime(strftime('%Y-%m-%d %H:00', timestamp), '+1 hour')
        )) - julianday(timestamp)) * 86400 AS INTEGER) as hour_duration,
        1 as segment
      FROM eventmodel
      WHERE bucket_id IN (
        SELECT key FROM bucketmodel WHERE type = 'currentwindow'
      )
      AND timestamp >= datetime('now', '-${daysBack} days')

      UNION ALL

      -- Recursive case: split remaining hours
      SELECT
        app_name,
        strftime('%Y-%m-%d %H:00', datetime(hour, '+1 hour')) as hour,
        event_start,
        event_end,
        duration,
        -- Calculate duration for this hour segment
        CAST((julianday(MIN(
          event_end,
          datetime(hour, '+2 hours')
        )) - julianday(MAX(
          event_start,
          datetime(hour, '+1 hour')
        ))) * 86400 AS INTEGER) as hour_duration,
        segment + 1
      FROM hour_splits
      WHERE datetime(hour, '+1 hour') < event_end
      AND segment < 100  -- Safety limit
    )
    SELECT
      hour,
      app_name,
      SUM(hour_duration) as total_duration
    FROM hour_splits
    WHERE hour_duration > 0
    GROUP BY hour, app_name
    ORDER BY hour DESC, total_duration DESC
  `;

  const results = db.prepare(query).all() as Array<{
    hour: string;
    app_name: string;
    total_duration: number;
  }>;

  return results.map((row) => ({
    hour: row.hour,
    appName: row.app_name || 'Unknown',
    duration: row.total_duration,
  }));
}

/**
 * Get daily activity heatmap data
 * Returns daily aggregated activity with productivity categorization
 * CORRECTLY handles events that span across day boundaries by splitting them
 */
export async function getDailyHeatmap(
  daysBack: number = 30
): Promise<DailyActivity[]> {
  const { db } = getActivityWatchDb();

  // Use recursive CTE to split events that cross day boundaries
  const query = `
    WITH RECURSIVE day_splits AS (
      -- Base case: get the first day of each event
      SELECT
        date(timestamp) as day,
        timestamp as event_start,
        datetime(timestamp, '+' || duration || ' seconds') as event_end,
        -- Calculate duration for first day segment
        CAST((julianday(MIN(
          datetime(timestamp, '+' || duration || ' seconds'),
          datetime(date(timestamp), '+1 day')
        )) - julianday(timestamp)) * 86400 AS INTEGER) as day_duration,
        1 as segment
      FROM eventmodel
      WHERE bucket_id IN (
        SELECT key FROM bucketmodel WHERE type = 'currentwindow'
      )
      AND timestamp >= datetime('now', '-${daysBack} days')

      UNION ALL

      -- Recursive case: split remaining days
      SELECT
        date(datetime(day, '+1 day')) as day,
        event_start,
        event_end,
        -- Calculate duration for this day segment
        CAST((julianday(MIN(
          event_end,
          datetime(day, '+2 days')
        )) - julianday(MAX(
          event_start,
          datetime(day, '+1 day')
        ))) * 86400 AS INTEGER) as day_duration,
        segment + 1
      FROM day_splits
      WHERE datetime(day, '+1 day') < event_end
      AND segment < 100  -- Safety limit
    )
    SELECT
      day,
      SUM(day_duration) as total_duration
    FROM day_splits
    WHERE day_duration > 0
    GROUP BY day
    ORDER BY day DESC
  `;

  const results = db.prepare(query).all() as Array<{
    day: string;
    total_duration: number;
  }>;

  return results.map((row) => {
    const duration = row.total_duration;
    // Simple categorization: >4hrs = productive, >2hrs = neutral, else idle
    let category: 'productive' | 'neutral' | 'idle' = 'idle';
    if (duration > 14400) category = 'productive'; // 4 hours
    else if (duration > 7200) category = 'neutral'; // 2 hours

    return {
      date: row.day,
      totalActive: duration,
      productive: category === 'productive' ? duration : 0,
      category,
    };
  });
}

/**
 * Get summary statistics for the dashboard
 * CORRECTLY handles events that span across day boundaries
 */
export async function getActivityStats(): Promise<ActivityStats> {
  const { db } = getActivityWatchDb();

  // Total active time today - properly split events crossing midnight
  const totalQuery = `
    WITH RECURSIVE day_splits AS (
      SELECT
        date(timestamp) as day,
        timestamp as event_start,
        datetime(timestamp, '+' || duration || ' seconds') as event_end,
        CAST((julianday(MIN(
          datetime(timestamp, '+' || duration || ' seconds'),
          datetime(date(timestamp), '+1 day')
        )) - julianday(timestamp)) * 86400 AS INTEGER) as day_duration,
        1 as segment
      FROM eventmodel
      WHERE bucket_id IN (
        SELECT key FROM bucketmodel WHERE type = 'currentwindow'
      )
      AND (date(timestamp) = date('now')
           OR datetime(timestamp, '+' || duration || ' seconds') >= datetime('now', 'start of day'))

      UNION ALL

      SELECT
        date(datetime(day, '+1 day')) as day,
        event_start,
        event_end,
        CAST((julianday(MIN(
          event_end,
          datetime(day, '+2 days')
        )) - julianday(MAX(
          event_start,
          datetime(day, '+1 day')
        ))) * 86400 AS INTEGER) as day_duration,
        segment + 1
      FROM day_splits
      WHERE datetime(day, '+1 day') < event_end
      AND segment < 10
    )
    SELECT SUM(day_duration) as total
    FROM day_splits
    WHERE day = date('now')
    AND day_duration > 0
  `;

  const totalResult = db.prepare(totalQuery).get() as { total: number | null };
  const totalActiveTime = totalResult?.total || 0;

  // Top 3 applications
  const topAppsQuery = `
    SELECT
      json_extract(datastr, '$.app') as app_name,
      SUM(duration) as total_duration
    FROM eventmodel
    WHERE bucket_id IN (
      SELECT key FROM bucketmodel WHERE type = 'currentwindow'
    )
    AND timestamp >= datetime('now', '-7 days')
    GROUP BY app_name
    ORDER BY total_duration DESC
    LIMIT 3
  `;

  const topAppsResults = db.prepare(topAppsQuery).all() as Array<{
    app_name: string;
    total_duration: number;
  }>;

  const topApps = topAppsResults.map((row) => ({
    name: row.app_name || 'Unknown',
    duration: row.total_duration,
  }));

  // Average session length (sessions are periods of continuous activity)
  const avgSessionQuery = `
    SELECT AVG(duration) as avg_duration, COUNT(*) as session_count
    FROM eventmodel
    WHERE bucket_id IN (
      SELECT key FROM bucketmodel WHERE type = 'currentwindow'
    )
    AND date(timestamp) = date('now')
  `;

  const avgResult = db.prepare(avgSessionQuery).get() as {
    avg_duration: number | null;
    session_count: number;
  };

  return {
    totalActiveTime,
    topApps,
    avgSessionLength: avgResult?.avg_duration || 0,
    sessionsToday: avgResult?.session_count || 0,
  };
}

/**
 * Get APM metrics from custom database
 * Returns empty array if no data exists yet
 */
export async function getAPMMetrics(
  daysBack: number = 7
): Promise<APMMetric[]> {
  const { db, drizzle } = getMetricsDb();

  const cutoffDate = subDays(new Date(), daysBack);

  const results = await drizzle
    .select()
    .from(apmLogs)
    .where(sql`${apmLogs.timestamp} >= ${cutoffDate.getTime() / 1000}`)
    .orderBy(sql`${apmLogs.timestamp} DESC`);

  return results.map((row) => ({
    timestamp: new Date(row.timestamp),
    keysPerMinute: row.keysPerMinute,
    mouseClicks: row.mouseClicks,
    mouseDistance: row.mouseDistance || undefined,
  }));
}

/**
 * Get website activity from Chrome/browser windows
 * Extracts domain/title from window events
 */
export async function getWebsiteActivity(
  daysBack: number = 7
): Promise<WebsiteActivity[]> {
  const { db } = getActivityWatchDb();

  // Query Chrome/browser window events and extract URLs/titles
  const query = `
    SELECT
      CASE
        WHEN json_extract(datastr, '$.title') LIKE '%- Google Chrome%'
          OR json_extract(datastr, '$.title') LIKE '%- Chrome%'
          OR json_extract(datastr, '$.title') LIKE '%- Mozilla Firefox%'
          OR json_extract(datastr, '$.title') LIKE '%- Firefox%'
          OR json_extract(datastr, '$.title') LIKE '%- Microsoft Edge%'
        THEN
          CASE
            WHEN instr(json_extract(datastr, '$.title'), ' - ') > 0
            THEN substr(json_extract(datastr, '$.title'), 1, instr(json_extract(datastr, '$.title'), ' - ') - 1)
            ELSE json_extract(datastr, '$.title')
          END
        ELSE NULL
      END as website,
      SUM(duration) as total_duration
    FROM eventmodel
    WHERE bucket_id IN (
      SELECT key FROM bucketmodel WHERE type = 'currentwindow'
    )
    AND json_extract(datastr, '$.app') IN ('chrome.exe', 'firefox.exe', 'msedge.exe', 'Google Chrome', 'Firefox', 'Microsoft Edge')
    AND timestamp >= datetime('now', '-${daysBack} days')
    AND website IS NOT NULL
    AND website != ''
    GROUP BY website
    ORDER BY total_duration DESC
  `;

  const results = db.prepare(query).all() as Array<{
    website: string;
    total_duration: number;
  }>;

  return results.map((row) => ({
    website: row.website,
    duration: row.total_duration,
  }));
}

/**
 * Insert sample APM data (for testing)
 */
export async function insertSampleAPMData() {
  const { drizzle } = getMetricsDb();

  const now = new Date();
  const sampleData = [
    {
      timestamp: now,
      keysPerMinute: 120,
      mouseClicks: 45,
      mouseDistance: 2500.5,
      activeWindow: 'Visual Studio Code',
    },
    {
      timestamp: new Date(now.getTime() - 3600000), // 1 hour ago
      keysPerMinute: 95,
      mouseClicks: 38,
      mouseDistance: 1800.2,
      activeWindow: 'Chrome',
    },
  ];

  await drizzle.insert(apmLogs).values(sampleData);
}
