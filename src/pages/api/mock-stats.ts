import type { APIRoute } from 'astro';

// Simple mock data - no database required
export const GET: APIRoute = async () => {
  const mockStats = {
    totalActiveTime: 16200, // 4.5 hours
    topApps: [
      { name: 'Visual Studio Code', duration: 7200 },
      { name: 'Google Chrome', duration: 5400 },
      { name: 'Terminal', duration: 3600 },
    ],
    avgSessionLength: 1350, // 22.5 minutes
    sessionsToday: 12,
  };

  return new Response(JSON.stringify(mockStats), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
