const express = require('express');
const path = require('path');
const app = express();

// CORS headers for cross-origin requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files from the parent directory (where index.html is)
app.use(express.static(path.join(__dirname, '..')));

// Serve the main HTML file from parent directory
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'index.html');
    console.log(`📄 Serving index.html from: ${indexPath}`);
    res.sendFile(indexPath);
});

// Debug frontend
app.get('/debug', (req, res) => {
    const debugPath = path.join(__dirname, '..', 'debug-frontend.html');
    console.log(`🔧 Serving debug frontend from: ${debugPath}`);
    res.sendFile(debugPath);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'whatsapp-frontend-client',
        timestamp: Date.now(),
        uptime: process.uptime(),
        version: '2.0.0'
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        frontend: 'online',
        backend_url: 'https://whatsapp-service-production-66d3.up.railway.app',
        timestamp: Date.now()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Frontend server running on port ${PORT}`);
    console.log(`📁 Serving files from: ${path.join(__dirname, '..')}`);
    console.log(`📄 Index.html path: ${path.join(__dirname, '..', 'index.html')}`);
    console.log(`🔧 Debug frontend: ${path.join(__dirname, '..', 'debug-frontend.html')}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
