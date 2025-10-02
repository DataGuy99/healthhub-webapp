import { createClient } from '@supabase/supabase-js';

export async function handler(event, context) {
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
    const userId = event.headers['x-user-id'] || 'default';

    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': allowedOrigin },
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const data = JSON.parse(event.body);

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Insert data into Supabase
    const { error } = await supabase
      .from('health_exports')
      .insert([{
        user_id: userId,
        export_time: new Date(data.time),
        data: data.data,
        received_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('❌ Supabase error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`✅ Stored health data for user ${userId}`);

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
      headers: { 'Access-Control-Allow-Origin': allowedOrigin },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
}
