const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Import Baileys with error handling
let makeWASocket, DisconnectReason, useMultiFileAuthState, QRCode;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default;
  DisconnectReason = baileys.DisconnectReason;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  QRCode = require('qrcode');
} catch (error) {
  console.error('Error importing dependencies:', error);
  process.exit(1);
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"]
  }
});

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
// WhatsApp connection variables
let sock;
let qrCodeData = null;
let connectionStatus = 'disconnected';

// Ensure auth directory exists
const authDir = './auth_info_baileys';
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
  console.log('Created auth directory:', authDir);
}

// Initialize WhatsApp connection
async function connectToWhatsApp() {
  try {
    console.log('Connecting to WhatsApp...');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: { level: 'silent' },
      browser: ['WhatsApp Client', 'Chrome', '10.15.7'],
      markOnlineOnConnect: true
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        try {
          qrCodeData = await QRCode.toDataURL(qr);
          connectionStatus = 'qr-ready';
          io.emit('qr-code', qrCodeData);
          console.log('QR Code generated and ready');
        } catch (error) {
          console.error('QR Code generation error:', error);
          connectionStatus = 'error';
          io.emit('connection-status', connectionStatus);
        }
      }
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed, reconnecting:', shouldReconnect);
        console.log('Last disconnect reason:', lastDisconnect?.error?.output?.statusCode);
        
        connectionStatus = 'disconnected';
        qrCodeData = null;
        io.emit('connection-status', connectionStatus);
        
        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 5000);
        }
      } else if (connection === 'open') {
        console.log('✅ Connected to WhatsApp successfully!');
        connectionStatus = 'connected';
        qrCodeData = null;
        io.emit('connection-status', connectionStatus);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', (m) => {
      // Handle incoming messages if needed
      console.log('Message received');
    });

  } catch (error) {
    console.error('Connection error:', error);
    connectionStatus = 'error';
    io.emit('connection-status', connectionStatus);
    
    // Retry connection after error
    setTimeout(connectToWhatsApp, 10000);
  }
}
// API Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'WhatsApp Backend API',
    status: connectionStatus,
    timestamp: new Date().toISOString(),
    node_version: process.version,
    env: NODE_ENV
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    whatsapp: connectionStatus,
    timestamp: new Date().toISOString(),
    node_version: process.version,
    uptime: process.uptime()
  });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: connectionStatus,
    hasQR: !!qrCodeData,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/qr', (req, res) => {
  res.json({ 
    qr: qrCodeData,
    status: connectionStatus
  });
});

app.post('/api/send-message', async (req, res) => {
  try {
    const { number, message } = req.body;
    
    if (!number || !message) {
      return res.status(400).json({ 
        error: 'Number and message are required',
        received: { number, message }
      });
    }
    
    if (!sock || connectionStatus !== 'connected') {
      return res.status(400).json({ 
        error: 'WhatsApp not connected',
        status: connectionStatus
      });
    }
    const id = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    const result = await sock.sendMessage(id, { text: message });
    
    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      messageId: result.key.id
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message
    });
  }
});

app.post('/api/send-bulk-message', async (req, res) => {
  try {
    const { numbers, message } = req.body;
    
    if (!numbers || !Array.isArray(numbers) || !message) {
      return res.status(400).json({ 
        error: 'Numbers array and message are required' 
      });
    }
    
    if (!sock || connectionStatus !== 'connected') {
      return res.status(400).json({ 
        error: 'WhatsApp not connected',
        status: connectionStatus
      });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const number of numbers) {
      try {
        const id = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const result = await sock.sendMessage(id, { text: message });
        results.push({ 
          number, 
          success: true, 
          messageId: result.key.id 
        });
        successCount++;
        
        // Rate limiting - wait 2 seconds between messages
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        results.push({ 
          number, 
          success: false, 
          error: error.message 
        });
        failCount++;
      }
    }    
    res.json({ 
      results,
      summary: {
        total: numbers.length,
        success: successCount,
        failed: failCount
      }
    });
  } catch (error) {
    console.error('Bulk send error:', error);
    res.status(500).json({ 
      error: 'Failed to send bulk messages',
      details: error.message
    });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current status to new client
  socket.emit('connection-status', connectionStatus);
  if (qrCodeData) {
    socket.emit('qr-code', qrCodeData);
  }

  socket.on('connect-whatsapp', () => {
    console.log('Client requested WhatsApp connection');
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      connectToWhatsApp();
    } else {
      socket.emit('connection-status', connectionStatus);
      if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log the error
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  if (sock) {
    sock.logout();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WhatsApp Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`🟢 Node version: ${process.version}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  
  // Start WhatsApp connection
  setTimeout(connectToWhatsApp, 2000);
});