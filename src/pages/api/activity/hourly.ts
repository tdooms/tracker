import type { APIRoute } from 'astro';
import { getHourlyActivity } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url }) => {
  try {
    const daysBack = parseInt(url.searchParams.get('days') || '7');
    const data = await getHourlyActivity(daysBack);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching hourly activity:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch hourly activity data' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
