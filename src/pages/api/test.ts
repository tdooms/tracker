import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const mockData = {
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    stats: {
      totalActiveTime: 14400,
      topApps: [
        { name: 'VS Code', duration: 7200 },
        { name: 'Chrome', duration: 5400 },
      ],
    },
  };

  return new Response(JSON.stringify(mockData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
