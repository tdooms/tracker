import type { APIRoute } from 'astro';
import { getDailyHeatmap } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url }) => {
  try {
    const daysBack = parseInt(url.searchParams.get('days') || '30');
    const data = await getDailyHeatmap(daysBack);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch heatmap data' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
