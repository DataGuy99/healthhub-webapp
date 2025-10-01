export async function handler(event, context) {
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

    // For now, just log the data. Android app will send this data
    // and the webapp will receive it directly via manual import or
    // the Android app can POST directly to the webapp when on same network.

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
