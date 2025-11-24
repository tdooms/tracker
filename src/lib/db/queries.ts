import { getTrackerDb } from './index';
import { inputMetrics } from './schema';
import { gte, lte, and, desc, asc } from 'drizzle-orm';

// Type definitions
export interface HourlyActivity {
  hour: string;
  appName: string;
  duration: number;
}

export interface ActivityStats {
  totalActiveTime: number;
  totalKeystrokes: number;
  topApps: { name: string; duration: number }[];
  avgSessionLength: number;
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
  duration: number;
}

export interface HeatmapData {
  day: string;
  hour: number;
  activity: number;
}

export interface FocusSession {
  startTime: string;
  endTime: string;
  duration: number;
  keystrokes: number;
  apps: string[];
}

export interface IdleDistribution {
  hour: number;
  totalIdleTime: number;
  idleCount: number;
}

export interface DailySummary {
  date: string;
  totalKeystrokes: number;
  totalClicks: number;
  mouseDistance: number;
  activeTime: number;
}

// Helper to get date range
function getDaysBack(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// Get input metrics (APM data)
export async function getTrackerInputMetrics(daysBack: number = 7): Promise<APMMetric[]> {
  const { drizzle } = getTrackerDb();
  const cutoff = getDaysBack(daysBack);

  const results = await drizzle
    .select()
    .from(inputMetrics)
    .where(gte(inputMetrics.timestamp, cutoff))
    .orderBy(desc(inputMetrics.timestamp));

  return results.map((row) => ({
    timestamp: new Date(row.timestamp),
    keysPerMinute: row.keyPresses,
    mouseClicks: row.mouseClicks,
    mouseDistance: row.mouseDistance,
  }));
}

// Get input metrics for specific date
export async function getInputMetricsForDate(date: string): Promise<APMMetric[]> {
  const { drizzle } = getTrackerDb();
  const startOfDay = new Date(date + 'T00:00:00.000Z').toISOString();
  const endOfDay = new Date(date + 'T23:59:59.999Z').toISOString();

  const results = await drizzle
    .select()
    .from(inputMetrics)
    .where(and(gte(inputMetrics.timestamp, startOfDay), lte(inputMetrics.timestamp, endOfDay)))
    .orderBy(asc(inputMetrics.timestamp));

  return results.map((row) => ({
    timestamp: new Date(row.timestamp),
    keysPerMinute: row.keyPresses,
    mouseClicks: row.mouseClicks,
    mouseDistance: row.mouseDistance,
  }));
}

// Get stats for specific date
export async function getTrackerStatsForDate(date: string): Promise<ActivityStats> {
  const { db } = getTrackerDb();
  const startOfDay = new Date(date + 'T00:00:00.000Z').toISOString();
  const endOfDay = new Date(date + 'T23:59:59.999Z').toISOString();

  const totalResult = db.prepare(`
    SELECT SUM(duration) as total
    FROM activity_log
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(startOfDay, endOfDay) as any;

  const keystrokesResult = db.prepare(`
    SELECT SUM(key_presses) as total_keystrokes
    FROM input_metrics
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(startOfDay, endOfDay) as any;

  const topAppsResults = db.prepare(`
    SELECT app_name, SUM(duration) as total_duration
    FROM activity_log
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY app_name
    ORDER BY total_duration DESC
    LIMIT 3
  `).all(startOfDay, endOfDay) as any[];

  const avgResult = db.prepare(`
    SELECT AVG(duration) as avg_duration, COUNT(*) as session_count
    FROM activity_log
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(startOfDay, endOfDay) as any;

  return {
    totalActiveTime: totalResult?.total || 0,
    totalKeystrokes: keystrokesResult?.total_keystrokes || 0,
    topApps: topAppsResults.map((r) => ({ name: r.app_name || 'Unknown', duration: r.total_duration })),
    avgSessionLength: avgResult?.avg_duration || 0,
    sessionsToday: avgResult?.session_count || 0,
  };
}

// Get hourly activity for specific date
export async function getTrackerHourlyActivityForDate(date: string): Promise<HourlyActivity[]> {
  const { db } = getTrackerDb();
  const startOfDay = new Date(date + 'T00:00:00.000Z').toISOString();
  const endOfDay = new Date(date + 'T23:59:59.999Z').toISOString();

  const results = db.prepare(`
    SELECT
      timestamp,
      app_name,
      duration
    FROM activity_log
    WHERE timestamp >= ? AND timestamp <= ?
  `).all(startOfDay, endOfDay) as any[];

  const idleRows = db.prepare(`
    SELECT start_time, end_time
    FROM idle_periods
    WHERE start_time >= ? AND start_time <= ? AND end_time IS NOT NULL
  `).all(startOfDay, endOfDay) as any[];

  const idleRanges = idleRows
    .map((row) => ({
      start: row.start_time ? new Date(row.start_time) : null,
      end: row.end_time ? new Date(row.end_time) : null,
    }))
    .filter((range) => range.start && range.end && range.end > range.start)
    .map((range) => ({ start: range.start as Date, end: range.end as Date }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const splitByIdle = (segmentStart: Date, segmentEnd: Date) => {
    let segments = [{ start: segmentStart, end: segmentEnd }];

    for (const idle of idleRanges) {
      const nextSegments: typeof segments = [];
      for (const segment of segments) {
        if (idle.end <= segment.start || idle.start >= segment.end) {
          nextSegments.push(segment);
          continue;
        }

        if (idle.start > segment.start) {
          nextSegments.push({ start: segment.start, end: idle.start });
        }
        if (idle.end < segment.end) {
          nextSegments.push({ start: idle.end, end: segment.end });
        }
      }

      segments = nextSegments;
      if (segments.length === 0) {
        break;
      }
    }

    return segments.filter((segment) => segment.end > segment.start);
  };

  const pad = (value: number) => value.toString().padStart(2, '0');
  const formatHour = (dateValue: Date) => {
    const year = dateValue.getFullYear();
    const month = pad(dateValue.getMonth() + 1);
    const day = pad(dateValue.getDate());
    const hour = pad(dateValue.getHours());
    return `${year}-${month}-${day} ${hour}:00`;
  };

  const addRangeToMap = (map: Map<string, number>, rangeStart: Date, rangeEnd: Date) => {
    let cursor = new Date(rangeStart);
    while (cursor < rangeEnd) {
      const hourStart = new Date(cursor);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);
      const segmentEnd = rangeEnd < hourEnd ? rangeEnd : hourEnd;
      const durationMs = segmentEnd.getTime() - cursor.getTime();
      if (durationMs > 0) {
        const hourKey = formatHour(hourStart);
        map.set(hourKey, (map.get(hourKey) || 0) + durationMs / 1000);
      }
      cursor = segmentEnd;
    }
  };

  const appHourlyMap = new Map<string, Map<string, number>>();

  const idleHourlyMap = new Map<string, number>();

  for (const row of results) {
    const durationSeconds = typeof row.duration === 'number' ? row.duration : 0;
    if (!row.timestamp || durationSeconds <= 0) {
      continue;
    }

    const start = new Date(row.timestamp);
    const end = new Date(start.getTime() + durationSeconds * 1000);
    let cursor = new Date(start);

    while (cursor < end) {
      const hourStart = new Date(cursor);
      hourStart.setMinutes(0);
      hourStart.setSeconds(0);
      hourStart.setMilliseconds(0);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);

      const segmentEnd = end < hourEnd ? end : hourEnd;
      if (segmentEnd <= cursor) {
        break;
      }

      const activeSegments = splitByIdle(cursor, segmentEnd);
      for (const active of activeSegments) {
        const segmentMs = active.end.getTime() - active.start.getTime();
        if (segmentMs <= 0) {
          continue;
        }

        const secondsInSegment = segmentMs / 1000;
        const hourKey = formatHour(active.start);
        const appName = row.app_name || 'Unknown';
        const hourMap = appHourlyMap.get(appName) ?? new Map<string, number>();
        hourMap.set(hourKey, (hourMap.get(hourKey) || 0) + secondsInSegment);
        appHourlyMap.set(appName, hourMap);
      }

      cursor = segmentEnd;
    }
  }

  idleRanges.forEach((idle) => {
    addRangeToMap(idleHourlyMap, idle.start, idle.end);
  });

  const hourlyData: HourlyActivity[] = [];

  appHourlyMap.forEach((hourMap, appName) => {
    hourMap.forEach((duration, hour) => {
      hourlyData.push({
        hour,
        appName,
        duration: Math.round(duration),
      });
    });
  });

  idleHourlyMap.forEach((duration, hour) => {
    if (duration > 0) {
      hourlyData.push({
        hour,
        appName: 'Idle',
        duration: Math.round(duration),
      });
    }
  });

  return hourlyData.sort((a, b) => {
    if (a.hour === b.hour) {
      return b.duration - a.duration;
    }
    return a.hour.localeCompare(b.hour);
  });
}

// Get website activity for specific date
export async function getTrackerWebsiteActivityForDate(date: string): Promise<WebsiteActivity[]> {
  const { db } = getTrackerDb();
  const startOfDay = new Date(date + 'T00:00:00.000Z').toISOString();
  const endOfDay = new Date(date + 'T23:59:59.999Z').toISOString();

  const results = db.prepare(`
    SELECT
      window_title,
      SUM(duration) as total_duration
    FROM activity_log
    WHERE app_name IN ('chrome.exe', 'firefox.exe', 'msedge.exe')
    AND timestamp >= ? AND timestamp <= ?
    AND window_title IS NOT NULL AND window_title != ''
    GROUP BY window_title
    ORDER BY total_duration DESC
  `).all(startOfDay, endOfDay) as any[];

  // Group by domain and sum durations
  const domainMap = new Map<string, number>();
  results.forEach((r) => {
    const domain = extractDomain(r.window_title);
    domainMap.set(domain, (domainMap.get(domain) || 0) + r.total_duration);
  });

  return Array.from(domainMap.entries())
    .map(([website, duration]) => ({ website, duration }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20);
}

// Get idle distribution for specific date
export async function getIdleDistributionForDate(date: string): Promise<IdleDistribution[]> {
  const { db } = getTrackerDb();
  const startOfDay = new Date(date + 'T00:00:00.000Z').toISOString();
  const endOfDay = new Date(date + 'T23:59:59.999Z').toISOString();

  const results = db.prepare(`
    SELECT
      CAST(strftime('%H', start_time) AS INTEGER) as hour,
      SUM(duration) as total_idle_time,
      COUNT(*) as idle_count
    FROM idle_periods
    WHERE start_time >= ? AND start_time <= ? AND end_time IS NOT NULL
    GROUP BY hour
    ORDER BY hour
  `).all(startOfDay, endOfDay) as any[];

  return results.map((r) => ({
    hour: r.hour,
    totalIdleTime: r.total_idle_time,
    idleCount: r.idle_count,
  }));
}

// Get hourly activity
export async function getTrackerHourlyActivity(daysBack: number = 7): Promise<HourlyActivity[]> {
  const { db } = getTrackerDb();
  const cutoff = getDaysBack(daysBack);

  const results = db.prepare(`
    SELECT
      strftime('%Y-%m-%d %H:00', timestamp) as hour,
      app_name,
      SUM(duration) as total_duration
    FROM activity_log
    WHERE timestamp >= ?
    GROUP BY hour, app_name
    ORDER BY hour DESC, total_duration DESC
  `).all(cutoff) as any[];

  return results.map((r) => ({
    hour: r.hour,
    appName: r.app_name,
    duration: r.total_duration,
  }));
}

// Get activity stats
export async function getTrackerStats(): Promise<ActivityStats> {
  const { db } = getTrackerDb();

  const totalResult = db.prepare(`
    SELECT SUM(duration) as total
    FROM activity_log
    WHERE date(timestamp) = date('now')
  `).get() as any;

  const keystrokesResult = db.prepare(`
    SELECT SUM(key_presses) as total_keystrokes
    FROM input_metrics
    WHERE date(timestamp) = date('now')
  `).get() as any;

  const topAppsResults = db.prepare(`
    SELECT app_name, SUM(duration) as total_duration
    FROM activity_log
    WHERE timestamp >= datetime('now', '-7 days')
    GROUP BY app_name
    ORDER BY total_duration DESC
    LIMIT 3
  `).all() as any[];

  const avgResult = db.prepare(`
    SELECT AVG(duration) as avg_duration, COUNT(*) as session_count
    FROM activity_log
    WHERE date(timestamp) = date('now')
  `).get() as any;

  return {
    totalActiveTime: totalResult?.total || 0,
    totalKeystrokes: keystrokesResult?.total_keystrokes || 0,
    topApps: topAppsResults.map((r) => ({ name: r.app_name || 'Unknown', duration: r.total_duration })),
    avgSessionLength: avgResult?.avg_duration || 0,
    sessionsToday: avgResult?.session_count || 0,
  };
}

// Helper function to extract domain from window title
function extractDomain(windowTitle: string): string {
  // Remove browser suffix
  let title = windowTitle
    .replace(/ - Google Chrome$/, '')
    .replace(/ - Chrome$/, '')
    .replace(/ - Mozilla Firefox$/, '')
    .replace(/ - Firefox$/, '')
    .replace(/ - Microsoft Edge$/, '')
    .replace(/ - Edge$/, '');

  // Common patterns for domain extraction
  // Pattern 1: "Page Title | Domain.com"
  if (title.includes(' | ')) {
    const parts = title.split(' | ');
    title = parts[parts.length - 1]; // Take the last part which is usually the domain
  }

  // Pattern 2: "Page Title - Domain.com"
  else if (title.includes(' - ')) {
    const parts = title.split(' - ');
    title = parts[parts.length - 1]; // Take the last part
  }

  // Pattern 3: Domain might be in parentheses
  const parenMatch = title.match(/\(([^)]+)\)$/);
  if (parenMatch) {
    title = parenMatch[1];
  }

  // Clean up common patterns
  title = title
    .replace(/^https?:\/\/(www\.)?/, '') // Remove protocol and www
    .replace(/\/.*$/, '') // Remove path
    .trim();

  return title || 'Unknown';
}

// Get website activity
export async function getTrackerWebsiteActivity(daysBack: number = 7): Promise<WebsiteActivity[]> {
  const { db } = getTrackerDb();
  const cutoff = getDaysBack(daysBack);

  const results = db.prepare(`
    SELECT
      window_title,
      SUM(duration) as total_duration
    FROM activity_log
    WHERE app_name IN ('chrome.exe', 'firefox.exe', 'msedge.exe')
    AND timestamp >= ?
    AND window_title IS NOT NULL AND window_title != ''
    GROUP BY window_title
    ORDER BY total_duration DESC
  `).all(cutoff) as any[];

  // Group by domain and sum durations
  const domainMap = new Map<string, number>();
  results.forEach((r) => {
    const domain = extractDomain(r.window_title);
    domainMap.set(domain, (domainMap.get(domain) || 0) + r.total_duration);
  });

  // Convert to array and sort
  return Array.from(domainMap.entries())
    .map(([website, duration]) => ({ website, duration }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20);
}

// Get activity heatmap
export async function getActivityHeatmap(daysBack: number = 30): Promise<HeatmapData[]> {
  const { db } = getTrackerDb();
  const cutoff = getDaysBack(daysBack);

  const results = db.prepare(`
    SELECT
      date(timestamp) as day,
      CAST(strftime('%H', timestamp) AS INTEGER) as hour,
      SUM(key_presses + mouse_clicks) as activity
    FROM input_metrics
    WHERE timestamp >= ?
    GROUP BY day, hour
    ORDER BY day, hour
  `).all(cutoff) as any[];

  return results;
}

// Get focus sessions
export async function getFocusSessions(daysBack: number = 7): Promise<FocusSession[]> {
  const { drizzle, db } = getTrackerDb();
  const cutoff = getDaysBack(daysBack);

  const metrics = await drizzle
    .select()
    .from(inputMetrics)
    .where(gte(inputMetrics.timestamp, cutoff))
    .orderBy(asc(inputMetrics.timestamp));

  const sessions: FocusSession[] = [];
  let current: any = null;
  const MAX_GAP = 5 * 60 * 1000; // 5 minutes in ms

  for (const metric of metrics) {
    const time = new Date(metric.timestamp).getTime();

    if (!current) {
      current = { start: metric.timestamp, end: metric.timestamp, keystrokes: metric.keyPresses };
    } else {
      const gap = time - new Date(current.end).getTime();

      if (gap <= MAX_GAP) {
        current.end = metric.timestamp;
        current.keystrokes += metric.keyPresses;
      } else {
        const duration = (new Date(current.end).getTime() - new Date(current.start).getTime()) / 1000;
        if (duration >= 600) {
          const apps = db.prepare(`
            SELECT DISTINCT app_name
            FROM activity_log
            WHERE timestamp >= ? AND timestamp <= ?
          `).all(current.start, current.end) as any[];

          sessions.push({
            startTime: current.start,
            endTime: current.end,
            duration,
            keystrokes: current.keystrokes,
            apps: apps.map((a) => a.app_name),
          });
        }
        current = { start: metric.timestamp, end: metric.timestamp, keystrokes: metric.keyPresses };
      }
    }
  }

  if (current) {
    const duration = (new Date(current.end).getTime() - new Date(current.start).getTime()) / 1000;
    if (duration >= 600) {
      const apps = db.prepare(`
        SELECT DISTINCT app_name
        FROM activity_log
        WHERE timestamp >= ? AND timestamp <= ?
      `).all(current.start, current.end) as any[];

      sessions.push({
        startTime: current.start,
        endTime: current.end,
        duration,
        keystrokes: current.keystrokes,
        apps: apps.map((a) => a.app_name),
      });
    }
  }

  return sessions.sort((a, b) => b.duration - a.duration);
}

// Get idle distribution
export async function getIdleDistribution(daysBack: number = 7): Promise<IdleDistribution[]> {
  const { db } = getTrackerDb();
  const cutoff = getDaysBack(daysBack);

  const results = db.prepare(`
    SELECT
      CAST(strftime('%H', start_time) AS INTEGER) as hour,
      SUM(duration) as total_idle_time,
      COUNT(*) as idle_count
    FROM idle_periods
    WHERE start_time >= ? AND end_time IS NOT NULL
    GROUP BY hour
    ORDER BY hour
  `).all(cutoff) as any[];

  return results.map((r) => ({
    hour: r.hour,
    totalIdleTime: r.total_idle_time,
    idleCount: r.idle_count,
  }));
}

// Get daily summary
export async function getDailySummary(daysBack: number = 30): Promise<DailySummary[]> {
  const { db } = getTrackerDb();
  const cutoff = getDaysBack(daysBack);

  const results = db.prepare(`
    SELECT
      date(im.timestamp) as day,
      SUM(im.key_presses) as total_keystrokes,
      SUM(im.mouse_clicks) as total_clicks,
      SUM(im.mouse_distance) as total_mouse_distance,
      (
        SELECT SUM(duration)
        FROM activity_log al
        WHERE date(al.timestamp) = date(im.timestamp)
      ) as total_active_time
    FROM input_metrics im
    WHERE im.timestamp >= ?
    GROUP BY day
    ORDER BY day DESC
  `).all(cutoff) as any[];

  return results.map((r) => ({
    date: r.day,
    totalKeystrokes: r.total_keystrokes,
    totalClicks: r.total_clicks,
    mouseDistance: r.total_mouse_distance,
    activeTime: r.total_active_time || 0,
  }));
}
