import type { APIRoute } from 'astro';
import { getAPMMetrics } from '../../lib/db/queries';

export const GET: APIRoute = async ({ url }) => {
  try {
    const daysBack = parseInt(url.searchParams.get('days') || '7');
    const data = await getAPMMetrics(daysBack);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching APM metrics:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch APM metrics' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
