export async function handler(event) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://legendary-chaja-e17d86.netlify.app';

  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod === 'GET') {
    try {
      const { getStore } = await import('@netlify/blobs');
      const store = getStore('health-data');

      const data = await store.get('exports', { type: 'json' }) || [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data, count: data.length })
      };
    } catch (error) {
      console.error('Failed to retrieve from Netlify Blobs:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to retrieve data', data: [] })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
}
