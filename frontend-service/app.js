const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Enhanced logging
console.log('🚀 Starting WhatsApp Frontend Server...');
console.log(`📊 Environment: ${NODE_ENV}`);
console.log(`🟢 Node version: ${process.version}`);
console.log(`🔗 Backend URL: ${BACKEND_URL}`);

// Security middleware
app.use((req, res, next) => {
  res.header('X-Powered-By', 'WhatsApp Client');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from the root directory (where index.html should be)
app.use(express.static(path.join(__dirname, '..')));

// Root route
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  console.log('Attempting to serve index.html from:', indexPath);
  
  // Check if index.html exists
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback if index.html doesn't exist
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>WhatsApp Client</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 40px; background: #f0f0f0; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
              .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
              .error { background: #ffe6e6; border: 1px solid #ff9999; }
              .success { background: #e6ffe6; border: 1px solid #99ff99; }
              .info { background: #e6f3ff; border: 1px solid #99ccff; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🚀 WhatsApp Client Frontend</h1>
              <div class="status info">
                  <strong>Server Status:</strong> Running<br>
                  <strong>Node Version:</strong> ${process.version}<br>
                  <strong>Environment:</strong> ${NODE_ENV}<br>
                  <strong>Backend URL:</strong> ${BACKEND_URL}
              </div>
              <div class="status error">
                  <strong>⚠️ Missing index.html</strong><br>
                  The main index.html file was not found. Please ensure it exists in the root directory.
              </div>
              <p><a href="/health">Check Health Status</a></p>
              <p><a href="${BACKEND_URL}/health" target="_blank">Check Backend Health</a></p>
          </div>
      </body>
      </html>
    `);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'frontend',
    timestamp: new Date().toISOString(),
    node_version: process.version,
    backend_url: BACKEND_URL,
    environment: NODE_ENV,
    uptime: process.uptime()
  });
});

// Proxy API requests to backend
app.use('/api', (req, res) => {
  const targetUrl = `${BACKEND_URL}${req.originalUrl}`;
  console.log(`Proxying ${req.method} ${req.originalUrl} to ${targetUrl}`);
  
  res.json({
    message: 'API proxy endpoint',
    method: req.method,
    original_url: req.originalUrl,
    target_url: targetUrl,
    note: 'Use fetch() from frontend to call backend directly'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 WhatsApp Frontend Server running on port ${PORT}`);
  console.log(`🔗 Backend URL: ${BACKEND_URL}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`🟢 Node version: ${process.version}`);
  console.log(`🌍 Access at: http://localhost:${PORT}`);
});