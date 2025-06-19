const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');

// Import Baileys
const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    delay
} = require('@whiskeysockets/baileys');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;

// Global variables
let sock;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;

// Auth directory
const authDir = path.join(tmpdir(), 'baileys_auth');
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
}

// Simple logger
const logger = {
    level: 'silent',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

async function connectToWhatsApp() {
    if (isConnecting) {
        console.log('Already connecting, please wait...');
        return;
    }

    try {
        isConnecting = true;
        console.log('🔄 Starting WhatsApp connection...');

        // Clean up existing connection
        if (sock) {
            try {
                sock.end();
            } catch (e) {}
        }

        // Clear previous auth for fresh start
        try {
            const files = fs.readdirSync(authDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(authDir, file));
            });
            console.log('🧹 Cleared previous auth data');
        } catch (e) {
            console.log('📂 No previous auth to clear');
        }

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp Client', 'Desktop', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            getMessage: async key => ({ conversation: 'hello' })
        });

        // Connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log('📡 Connection update:', { connection, qr: !!qr });

            if (qr) {
                try {
                    console.log('📱 Generating QR Code...');
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ QR Code generated and sent to clients');
                } catch (error) {
                    console.error('❌ QR generation failed:', error);
                    connectionStatus = 'error';
                    io.emit('connection-status', connectionStatus);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('🔌 Connection closed. Status:', statusCode);
                
                connectionStatus = 'disconnected';
                qrCodeData = null;
                isConnecting = false;
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);

                // Handle different disconnect reasons
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Logged out');
                } else if (statusCode === DisconnectReason.badSession) {
                    console.log('🔄 Bad session, will reconnect');
                    setTimeout(connectToWhatsApp, 3000);
                } else if (statusCode === DisconnectReason.connectionClosed) {
                    console.log('🔄 Connection closed, will reconnect');
                    setTimeout(connectToWhatsApp, 3000);
                } else if (statusCode === DisconnectReason.connectionLost) {
                    console.log('🔄 Connection lost, will reconnect');
                    setTimeout(connectToWhatsApp, 3000);
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Restart required');
                    setTimeout(connectToWhatsApp, 2000);
                } else if (statusCode !== DisconnectReason.connectionReplaced) {
                    console.log('🔄 Unexpected disconnect, will reconnect');
                    setTimeout(connectToWhatsApp, 5000);
                }
            } else if (connection === 'open') {
                console.log('✅ Connected to WhatsApp successfully!');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
            } else if (connection === 'connecting') {
                console.log('🔗 Connecting...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
            }
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        // Message events
        sock.ev.on('messages.upsert', async m => {
            console.log('📨 Received messages:', m.messages.length);
        });

    } catch (error) {
        console.error('❌ Connection error:', error);
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
        
        // Retry connection
        setTimeout(connectToWhatsApp, 10000);
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
        hasQR: !!qrCodeData,
        isConnecting: isConnecting
    });
});

app.post('/api/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({ error: 'Number and message required' });
        }
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        // Format number
        let formattedNumber = number.toString().replace(/[^\d]/g, '');
        if (!formattedNumber.includes('@')) {
            formattedNumber = `${formattedNumber}@s.whatsapp.net`;
        }

        console.log(`📤 Sending message to ${formattedNumber}`);
        await sock.sendMessage(formattedNumber, { text: message });
        
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('❌ Send error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.post('/api/send-bulk', async (req, res) => {
    try {
        const { numbers, message } = req.body;
        
        if (!numbers || !Array.isArray(numbers) || !message) {
            return res.status(400).json({ error: 'Numbers array and message required' });
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
                
                // Delay between messages
                if (numbers.length > 1) {
                    await delay(2000);
                }
            } catch (error) {
                console.error(`❌ Error sending to ${number}:`, error);
                results.push({ number, success: false, error: error.message });
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Bulk send completed',
            results: results 
        });
    } catch (error) {
        console.error('❌ Bulk send error:', error);
        res.status(500).json({ error: 'Failed to send bulk messages' });
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
        console.log('🔌 Client requested connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            connectToWhatsApp();
        }
    });

    socket.on('disconnect', () => {
        console.log(`👋 Client disconnected: ${socket.id}`);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    if (sock) {
        try {
            await sock.logout();
        } catch (e) {}
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received');
    if (sock) {
        try {
            await sock.logout();
        } catch (e) {}
    }
    process.exit(0);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Node version: ${process.version}`);
    console.log(`📁 Auth directory: ${authDir}`);
    console.log('⏳ Ready to connect to WhatsApp');
});