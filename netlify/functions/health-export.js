export async function handler(event, context) {
  // Handle CORS preflight
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://legendary-chaja-e17d86.netlify.app';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, X-User-ID',
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
    // Get userId from header
    const userId = event.headers['x-user-id'] || 'default';

    // Validate body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': allowedOrigin },
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    if (event.body.length > 1048576) {
      return {
        statusCode: 413,
        headers: { 'Access-Control-Allow-Origin': allowedOrigin },
        body: JSON.stringify({ error: 'Payload too large' })
      };
    }

    const data = JSON.parse(event.body);

    if (!data || typeof data !== 'object') {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': allowedOrigin },
        body: JSON.stringify({ error: 'Invalid data format' })
      };
    }

    // Store to Firebase Realtime Database
    const FIREBASE_URL = process.env.FIREBASE_URL || 'https://healthhub-data-default-rtdb.firebaseio.com';

    // Get existing data
    const getResponse = await fetch(`${FIREBASE_URL}/users/${userId}/metrics.json`);
    let existing = [];

    if (getResponse.ok) {
      const firebaseData = await getResponse.json();
      existing = firebaseData || [];
    }

    // Append new data with timestamp
    existing.push({
      ...data,
      receivedAt: new Date().toISOString()
    });

    // Keep last 1000 entries
    if (existing.length > 1000) {
      existing = existing.slice(-1000);
    }

    // Store to Firebase
    const putResponse = await fetch(`${FIREBASE_URL}/users/${userId}/metrics.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existing)
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      console.error(`❌ Firebase PUT failed: ${putResponse.status} - ${errorText}`);
      throw new Error(`Firebase error: ${putResponse.status} - ${errorText}`);
    }

    const putResult = await putResponse.json();
    console.log(`✅ Stored ${existing.length} metrics for user ${userId}`, putResult);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin
      },
      body: JSON.stringify({
        success: true,
        message: 'Export received and stored successfully',
        count: existing.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('❌ Error processing export:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': allowedOrigin },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
}
