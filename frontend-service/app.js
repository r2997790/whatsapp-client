const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the parent directory (where index.html is)
app.use(express.static(path.join(__dirname, '..')));

// Serve the main HTML file from parent directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Frontend server running on port ${PORT}`);
    console.log(`Serving index.html from: ${path.join(__dirname, '..', 'index.html')}`);
});
