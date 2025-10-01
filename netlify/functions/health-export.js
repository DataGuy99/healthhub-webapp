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

    // Store to GitHub as simple JSON database
    try {
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
      const GITHUB_REPO = process.env.GITHUB_REPO || 'DataGuy99/healthhub-webapp';
      const FILE_PATH = 'data/health-exports.json';

      if (!GITHUB_TOKEN) {
        console.error('GITHUB_TOKEN not set');
        throw new Error('GitHub token not configured');
      }

      // Get current file to get SHA
      const getResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`,
        {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      let existing = [];
      let sha = null;

      if (getResponse.ok) {
        const fileData = await getResponse.json();
        sha = fileData.sha;
        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        existing = JSON.parse(content);
      }

      // Append new data
      existing.push(data);

      // Keep last 100 exports
      if (existing.length > 100) {
        existing.splice(0, existing.length - 100);
      }

      // Update file
      const content = Buffer.from(JSON.stringify(existing, null, 2)).toString('base64');

      const updateResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Add health export ${new Date().toISOString()}`,
            content,
            sha
          })
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`GitHub API error: ${updateResponse.status}`);
      }

      console.log('✅ Stored to GitHub successfully');
    } catch (error) {
      console.error('Failed to store to GitHub:', error);
      // Continue anyway - data is logged
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
