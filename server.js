const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Import Baileys with proper error handling
let makeWASocket, DisconnectReason, useMultiFileAuthState;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default;
  DisconnectReason = baileys.DisconnectReason;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
} catch (error) {
  console.error('Error importing Baileys:', error);
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;

let sock;
let qrCodeData = null;
let connectionStatus = 'disconnected';

// Ensure auth directory exists
const authDir = './auth_info_baileys';
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// Simple logger that satisfies Baileys requirements
const logger = {
  level: 'silent',
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  child: function() { return this; }
};

async function connectToWhatsApp() {
  try {
    console.log('🔄 Attempting WhatsApp connection...');
    
    if (!makeWASocket) {
      throw new Error('Baileys not properly loaded');
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: logger,
      browser: ['WhatsApp Client', 'Chrome', '10.15.7']
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log('Connection update:', { connection, qr: !!qr });
      
      if (qr) {
        try {
          qrCodeData = await QRCode.toDataURL(qr);
          connectionStatus = 'qr-ready';
          io.emit('qr-code', qrCodeData);
          io.emit('connection-status', connectionStatus);
          console.log('✅ QR Code generated successfully');
        } catch (error) {
          console.error('❌ QR Code generation error:', error);
          connectionStatus = 'error';
          io.emit('connection-status', connectionStatus);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`Connection closed. Status: ${statusCode}, Reconnecting: ${shouldReconnect}`);
        
        connectionStatus = 'disconnected';
        qrCodeData = null;
        io.emit('connection-status', connectionStatus);
        
        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000);
        }
      } else if (connection === 'open') {
        console.log('✅ Connected to WhatsApp successfully!');
        connectionStatus = 'connected';
        qrCodeData = null;
        io.emit('connection-status', connectionStatus);
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (error) {
    console.error('❌ WhatsApp connection error:', error);
    connectionStatus = 'error';
    io.emit('connection-status', connectionStatus);
    
    // Retry after delay
    setTimeout(connectToWhatsApp, 5000);
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    whatsapp: connectionStatus,
    timestamp: new Date().toISOString(),
    node_version: process.version,
    baileys_loaded: !!makeWASocket
  });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: connectionStatus,
    hasQR: !!qrCodeData,
    baileys_available: !!makeWASocket
  });
});

app.get('/api/qr', (req, res) => {
  res.json({ qr: qrCodeData });
});

app.post('/api/send-message', async (req, res) => {
  try {
    const { number, message } = req.body;
    
    if (!sock || connectionStatus !== 'connected') {
      return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    const id = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    await sock.sendMessage(id, { text: message });
    
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log(`👤 Client connected: ${socket.id}`);
  
  // Send current status
  socket.emit('connection-status', connectionStatus);
  if (qrCodeData) {
    socket.emit('qr-code', qrCodeData);
  }

  socket.on('connect-whatsapp', () => {
    console.log('🔌 Client requested WhatsApp connection');
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
    console.log(`👋 Client disconnected: ${socket.id}`);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  if (sock) {
    sock.logout();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WhatsApp Server running on port ${PORT}`);
  console.log(`🌍 URL: http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🟢 Node version: ${process.version}`);
  console.log(`📦 Baileys loaded: ${!!makeWASocket}`);
  
  // Start WhatsApp connection after server starts
  setTimeout(() => {
    console.log('🔄 Starting WhatsApp connection...');
    connectToWhatsApp();
  }, 3000);
});