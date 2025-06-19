const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');

// Import Baileys with proper error handling
let makeWASocket, DisconnectReason, useMultiFileAuthState, delay;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default;
  DisconnectReason = baileys.DisconnectReason;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  delay = baileys.delay;
  console.log('✅ Baileys imported successfully, version:', baileys.version || 'unknown');
} catch (error) {
  console.error('❌ Error importing Baileys:', error);
  process.exit(1);
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;

let sock;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;

// Use tmp directory for auth info in Railway (ephemeral filesystem)
const authDir = path.join(tmpdir(), 'auth_info_baileys');
console.log('📁 Auth directory:', authDir);

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
  try {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('✅ Created auth directory');
  } catch (error) {
    console.error('❌ Failed to create auth directory:', error);
  }
}

// Pino logger configuration for Baileys
const logger = require('pino')({
  level: 'silent'
});

async function connectToWhatsApp() {
  if (isConnecting) {
    console.log('⚠️ Connection already in progress, skipping...');
    return;
  }

  try {
    isConnecting = true;
    console.log('🔄 Attempting WhatsApp connection...');
    
    if (!makeWASocket) {
      throw new Error('Baileys not properly loaded');
    }
    
    // Clean up existing connection
    if (sock) {
      try {
        sock.end();
      } catch (e) {
        console.log('Previous connection cleanup:', e.message);
      }
    }
    
    // Clear any existing auth state for fresh QR generation
    try {
      const files = fs.readdirSync(authDir);
      for (const file of files) {
        if (file.startsWith('creds.json') || file.startsWith('app-state-sync-key') || file.startsWith('app-state-sync-version')) {
          fs.unlinkSync(path.join(authDir, file));
        }
      }
      console.log('🧹 Cleared previous auth state for fresh QR generation');
    } catch (error) {
      console.log('📂 No previous auth state to clear:', error.message);
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    console.log('📱 Auth state loaded');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true, // Also print QR in terminal for debugging
      logger: logger,
      browser: ['WhatsApp Web Client', 'Chrome', '130.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      mobile: false, // Ensure we're using web client mode
      getMessage: async key => {
        return {
          conversation: 'hello'
        }
      }
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log('🔔 Connection update:', { 
        connection, 
        qr: !!qr, 
        lastDisconnect: lastDisconnect?.error?.output?.statusCode 
      });
      
      if (qr) {
        try {
          console.log('📱 Generating QR Code...');
          console.log('QR String:', qr.substring(0, 50) + '...');
          
          qrCodeData = await QRCode.toDataURL(qr, { 
            scale: 8, 
            margin: 2,
            width: 512,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
          });
          
          connectionStatus = 'qr-ready';
          console.log('✅ QR Code generated successfully, length:', qrCodeData.length);
          
          // Emit to all connected clients
          io.emit('qr-code', qrCodeData);
          io.emit('connection-status', connectionStatus);
          
          console.log('📡 QR Code emitted to clients');
        } catch (error) {
          console.error('❌ QR Code generation error:', error);
          connectionStatus = 'error';
          io.emit('connection-status', connectionStatus);
          io.emit('qr-code', null);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`🔌 Connection closed. Status: ${statusCode}, Reconnecting: ${shouldReconnect}`);
        
        connectionStatus = 'disconnected';
        qrCodeData = null;
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
        io.emit('qr-code', null);
        
        if (shouldReconnect && statusCode !== DisconnectReason.badSession) {
          console.log('🔄 Reconnecting in 3 seconds...');
          setTimeout(() => {
            connectToWhatsApp();
          }, 3000);
        } else {
          console.log('🚫 Manual reconnection required');
        }
      } else if (connection === 'open') {
        console.log('✅ Connected to WhatsApp successfully!');
        connectionStatus = 'connected';
        qrCodeData = null;
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
        io.emit('qr-code', null);
      } else if (connection === 'connecting') {
        connectionStatus = 'connecting';
        console.log('🔗 Connecting to WhatsApp...');
        io.emit('connection-status', connectionStatus);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Handle messages (optional - for debugging)
    sock.ev.on('messages.upsert', async m => {
      console.log('📨 Message received:', m.messages.length);
    });

  } catch (error) {
    console.error('❌ WhatsApp connection error:', error);
    connectionStatus = 'error';
    isConnecting = false;
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
    
    // Retry after delay
    console.log('🔄 Retrying connection in 10 seconds...');
    setTimeout(() => {
      connectToWhatsApp();
    }, 10000);
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
    baileys_loaded: !!makeWASocket,
    auth_dir: authDir,
    uptime: process.uptime(),
    has_qr: !!qrCodeData
  });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: connectionStatus,
    hasQR: !!qrCodeData,
    baileys_available: !!makeWASocket,
    isConnecting: isConnecting,
    node_version: process.version
  });
});

app.get('/api/qr', (req, res) => {
  res.json({ qr: qrCodeData });
});

app.post('/api/send-message', async (req, res) => {
  try {
    const { number, message } = req.body;
    
    if (!number || !message) {
      return res.status(400).json({ error: 'Number and message are required' });
    }
    
    if (!sock || connectionStatus !== 'connected') {
      return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    // Format phone number
    let formattedNumber = number.toString().replace(/[^\d]/g, '');
    if (!formattedNumber.includes('@')) {
      formattedNumber = `${formattedNumber}@s.whatsapp.net`;
    }

    console.log(`📤 Sending message to ${formattedNumber}: ${message.substring(0, 50)}...`);
    
    await sock.sendMessage(formattedNumber, { text: message });
    
    console.log('✅ Message sent successfully');
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({ 
      error: 'Failed to send message', 
      details: error.message 
    });
  }
});

app.post('/api/send-bulk', async (req, res) => {
  try {
    const { numbers, message } = req.body;
    
    if (!numbers || !Array.isArray(numbers) || !message) {
      return res.status(400).json({ error: 'Numbers array and message are required' });
    }
    
    if (!sock || connectionStatus !== 'connected') {
      return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    const results = [];
    
    for (const number of numbers) {
      try {
        let formattedNumber = number.toString().replace(/[^\d]/g, '');
        if (!formattedNumber.includes('@')) {
          formattedNumber = `${formattedNumber}@s.whatsapp.net`;
        }

        await sock.sendMessage(formattedNumber, { text: message });
        results.push({ number, success: true });
        
        // Add delay between messages
        if (numbers.length > 1) {
          await delay(2000);
        }
      } catch (error) {
        console.error(`❌ Error sending to ${number}:`, error);
        results.push({ number, success: false, error: error.message });
      }
    }
    
    console.log(`📤 Bulk send completed: ${results.filter(r => r.success).length}/${results.length} successful`);
    res.json({ 
      success: true, 
      message: 'Bulk send completed',
      results: results 
    });
  } catch (error) {
    console.error('❌ Bulk send error:', error);
    res.status(500).json({ 
      error: 'Failed to send bulk messages', 
      details: error.message 
    });
  }
});

// Force new QR code generation
app.post('/api/generate-qr', (req, res) => {
  try {
    console.log('🔄 Manual QR generation requested');
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      connectToWhatsApp();
      res.json({ success: true, message: 'QR generation initiated' });
    } else {
      res.json({ success: false, message: 'Already connected or connecting' });
    }
  } catch (error) {
    console.error('❌ QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log(`👤 Client connected: ${socket.id}`);
  
  // Send current status immediately
  socket.emit('connection-status', connectionStatus);
  if (qrCodeData) {
    console.log('📤 Sending existing QR code to new client');
    socket.emit('qr-code', qrCodeData);
  }

  socket.on('connect-whatsapp', () => {
    console.log('🔌 Client requested WhatsApp connection');
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      connectToWhatsApp();
    } else {
      console.log(`📡 Current status: ${connectionStatus}`);
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
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.log('Logout error:', e.message);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.log('Logout error:', e.message);
    }
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
  console.log(`📁 Auth directory: ${authDir}`);
  
  // Do NOT auto-start WhatsApp connection - wait for user request
  console.log('⏳ Ready to connect to WhatsApp when requested by user');
});