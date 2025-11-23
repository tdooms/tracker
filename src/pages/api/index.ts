import type { APIRoute } from 'astro';
import {
  getTrackerStats,
  getTrackerStatsForDate,
  getTrackerInputMetrics,
  getInputMetricsForDate,
  getTrackerHourlyActivity,
  getTrackerHourlyActivityForDate,
  getTrackerWebsiteActivity,
  getTrackerWebsiteActivityForDate,
  getActivityHeatmap,
  getFocusSessions,
  getIdleDistribution,
  getIdleDistributionForDate,
  getDailySummary
} from '../../lib/db/queries';

export const GET: APIRoute = async ({ url }) => {
  const endpoint = url.searchParams.get('endpoint') || 'stats';
  const days = parseInt(url.searchParams.get('days') || '7');
  const date = url.searchParams.get('date');

  let data;
  switch (endpoint) {
    case 'stats':
      data = date ? await getTrackerStatsForDate(date) : await getTrackerStats();
      break;
    case 'apm':
      data = date ? await getInputMetricsForDate(date) : await getTrackerInputMetrics(days);
      break;
    case 'hourly':
      data = date ? await getTrackerHourlyActivityForDate(date) : await getTrackerHourlyActivity(days);
      break;
    case 'websites':
      data = date ? await getTrackerWebsiteActivityForDate(date) : await getTrackerWebsiteActivity(days);
      break;
    case 'heatmap':
      data = await getActivityHeatmap(days);
      break;
    case 'focus-sessions':
      data = await getFocusSessions(days);
      break;
    case 'idle-distribution':
      data = date ? await getIdleDistributionForDate(date) : await getIdleDistribution(days);
      break;
    case 'daily-summary':
      data = await getDailySummary(days);
      break;
    default:
      data = { error: 'Unknown endpoint' };
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};
