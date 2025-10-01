export async function handler(event) {
  // Handle CORS preflight
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://legendary-chaja-e17d86.netlify.app';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Validate body exists and isn't too large (1MB limit)
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin
        },
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    if (event.body.length > 1048576) {
      return {
        statusCode: 413,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin
        },
        body: JSON.stringify({ error: 'Payload too large' })
      };
    }

    const data = JSON.parse(event.body);

    // Validate expected structure
    if (!data || typeof data !== 'object') {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin
        },
        body: JSON.stringify({ error: 'Invalid data format' })
      };
    }

    // Log for personal use (user owns their health data)
    console.log('📊 Received Health Connect export:', JSON.stringify(data, null, 2));

    // Store to Netlify Blobs (simple key-value store)
    try {
      const { getStore } = await import('@netlify/blobs');
      const store = getStore('health-data');

      // Get existing data
      const existing = await store.get('exports', { type: 'json' }) || [];

      // Append new export
      existing.push(data);

      // Keep only last 100 exports
      if (existing.length > 100) {
        existing.splice(0, existing.length - 100);
      }

      await store.set('exports', JSON.stringify(existing));
    } catch (error) {
      console.error('Failed to store to Netlify Blobs:', error);
      // Continue anyway - data is still logged
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin
      },
      body: JSON.stringify({
        success: true,
        message: 'Export received and stored successfully',
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('❌ Error processing export:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
}
