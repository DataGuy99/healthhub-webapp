import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = 3001;

// Middleware to parse JSON
app.use(express.json());

// CORS middleware to allow requests from any origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health Connect export endpoints (support both singular and plural)
const handleExport = async (req, res) => {
  try {
    console.log('📊 Received Health Connect export:');
    console.log(JSON.stringify(req.body, null, 2));

    // Save to file for inspection
    const exportDir = './health-exports';
    await fs.mkdir(exportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(exportDir, `export-${timestamp}.json`);

    await fs.writeFile(filename, JSON.stringify(req.body, null, 2));
    console.log(`💾 Saved to ${filename}`);

    res.status(200).json({
      success: true,
      message: 'Export received successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error processing export:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

app.post('/health-export', handleExport);
app.post('/health-exports', handleExport);

// Root endpoint for testing
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Health Connect Export Webhook Server',
    endpoints: {
      'POST /health-export': 'Receive Health Connect exports'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Webhook server listening on http://0.0.0.0:${PORT}`);
  console.log(`📡 Health Connect exports should POST to: http://<your-ip>:${PORT}/health-export`);
  console.log(`\n⚠️  Make sure your phone and this server are on the same network!`);
});
