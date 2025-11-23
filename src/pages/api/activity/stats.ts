import type { APIRoute } from 'astro';
import { getActivityStats } from '../../../lib/db/queries';

export const GET: APIRoute = async () => {
  try {
    const data = await getActivityStats();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch activity statistics' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
