const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

// Create a proper logger object for Baileys
const logger = {
  level: 'silent',
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => logger
};

async function connectToWhatsApp() {
  try {
    console.log('Connecting to WhatsApp...');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: logger,
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
          console.error('QR Code error:', error);
        }
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed, reconnecting:', shouldReconnect);
        connectionStatus = 'disconnected';
        qrCodeData = null;
        io.emit('connection-status', connectionStatus);
        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000);
        }
      } else if (connection === 'open') {
        console.log('Connected to WhatsApp!');
        connectionStatus = 'connected';
        qrCodeData = null;
        io.emit('connection-status', connectionStatus);
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (error) {
    console.error('Connection error:', error);
    connectionStatus = 'error';
    io.emit('connection-status', connectionStatus);
    
    // Retry connection after error
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
    node_version: process.version
  });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: connectionStatus,
    hasQR: !!qrCodeData
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
  console.log('Client connected');
  socket.emit('connection-status', connectionStatus);
  if (qrCodeData) {
    socket.emit('qr-code', qrCodeData);
  }

  socket.on('connect-whatsapp', () => {
    console.log('Client requested WhatsApp connection');
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      connectToWhatsApp();
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WhatsApp Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Node version: ${process.version}`);
  
  // Start WhatsApp connection
  setTimeout(() => {
    console.log('Starting WhatsApp connection...');
    connectToWhatsApp();
  }, 2000);
});