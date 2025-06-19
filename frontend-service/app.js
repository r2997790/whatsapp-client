const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    backend_url: BACKEND_URL
  });
});

// API proxy endpoints (optional)
app.get('/api/*', (req, res) => {
  res.redirect(`${BACKEND_URL}${req.path}`);
});

app.post('/api/*', (req, res) => {
  res.redirect(307, `${BACKEND_URL}${req.path}`);
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WhatsApp Frontend Server running on port ${PORT}`);
  console.log(`Backend URL: ${BACKEND_URL}`);
});