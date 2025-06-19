const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');

// Import Baileys with specific working configuration
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

// Auth directory - use different path to avoid conflicts
const authDir = path.join(tmpdir(), 'wa_auth_' + Date.now());
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
}

console.log('📁 Using auth directory:', authDir);

// Pino logger with minimal config
const P = require('pino');
const logger = P({ 
    level: 'silent',
    timestamp: false 
}, P.destination({ sync: false }));

async function connectToWhatsApp() {
    if (isConnecting) {
        console.log('⚠️ Already connecting, please wait...');
        return;
    }

    try {
        isConnecting = true;
        console.log('🔄 Initializing WhatsApp connection...');

        // Clean up existing socket
        if (sock) {
            try {
                sock.end();
                sock = null;
            } catch (e) {
                console.log('Socket cleanup:', e.message);
            }
        }

        // Create completely fresh auth directory
        const newAuthDir = path.join(tmpdir(), 'wa_auth_' + Date.now());
        if (!fs.existsSync(newAuthDir)) {
            fs.mkdirSync(newAuthDir, { recursive: true });
        }

        console.log('📂 Using fresh auth directory:', newAuthDir);

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(newAuthDir);
        console.log('🔐 Auth state initialized');

        // Create socket with minimal, working configuration
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            fireInitQueries: true,
            emitOwnEvents: false,
            version: [2, 2413, 1],
            getMessage: async () => ({ conversation: 'hello' })
        });

        console.log('🔌 Socket created, setting up event handlers...');

        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log('📡 Connection update:', { 
                connection, 
                qr: !!qr,
                lastDisconnectCode: lastDisconnect?.error?.output?.statusCode
            });

            if (qr) {
                try {
                    console.log('📱 QR Code received, generating image...');
                    
                    // Generate QR with specific settings for better compatibility
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 10,
                        margin: 4,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        },
                        errorCorrectionLevel: 'H',
                        type: 'image/png',
                        quality: 1,
                        width: 400
                    });
                    
                    connectionStatus = 'qr-ready';
                    console.log('✅ QR Code generated, sending to clients...');
                    
                    // Emit to all clients
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    
                    console.log('📤 QR Code sent to', io.sockets.sockets.size, 'clients');
                } catch (error) {
                    console.error('❌ QR generation failed:', error);
                    connectionStatus = 'error';
                    io.emit('connection-status', connectionStatus);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('🔌 Connection closed with status:', statusCode);
                
                connectionStatus = 'disconnected';
                qrCodeData = null;
                isConnecting = false;
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);

                // Handle different disconnect reasons more conservatively
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Logged out - manual reconnection required');
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('🔄 Connection replaced - stopping');
                } else if (statusCode === DisconnectReason.multideviceMismatch) {
                    console.log('📱 Multi-device mismatch');
                } else {
                    // For any other disconnect, wait before reconnecting
                    console.log('🔄 Will attempt reconnection in 5 seconds...');
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 5000);
                }
                
            } else if (connection === 'open') {
                console.log('✅ Successfully connected to WhatsApp!');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
            } else if (connection === 'connecting') {
                console.log('🔗 Connecting to WhatsApp...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
            }
        });

        // Credentials update handler
        sock.ev.on('creds.update', saveCreds);

        // Message handler
        sock.ev.on('messages.upsert', async (m) => {
            console.log('📨 Received', m.messages.length, 'message(s)');
        });

        console.log('✅ Event handlers set up successfully');

    } catch (error) {
        console.error('❌ Connection setup error:', error);
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
        
        // Retry with delay
        console.log('🔄 Retrying in 10 seconds...');
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
        auth_dir: authDir,
        has_qr: !!qrCodeData,
        connected_clients: io.sockets.sockets.size
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        hasQR: !!qrCodeData,
        isConnecting: isConnecting,
        timestamp: new Date().toISOString()
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

        console.log(`📤 Sending message to ${formattedNumber}: ${message.substring(0, 50)}...`);
        await sock.sendMessage(formattedNumber, { text: message });
        
        console.log('✅ Message sent successfully');
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('❌ Send error:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.message });
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
        
        const successful = results.filter(r => r.success).length;
        console.log(`📤 Bulk send completed: ${successful}/${results.length} successful`);
        
        res.json({ 
            success: true, 
            message: 'Bulk send completed',
            results: results 
        });
    } catch (error) {
        console.error('❌ Bulk send error:', error);
        res.status(500).json({ error: 'Failed to send bulk messages', details: error.message });
    }
});

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log(`👤 Client connected: ${socket.id} (Total: ${io.sockets.sockets.size})`);
    
    // Send current status immediately
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        console.log('📤 Sending existing QR to new client');
        socket.emit('qr-code', qrCodeData);
    }

    socket.on('connect-whatsapp', () => {
        console.log('🔌 Client requested WhatsApp connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            connectToWhatsApp();
        } else {
            console.log('📡 Current status:', connectionStatus);
            socket.emit('connection-status', connectionStatus);
            if (qrCodeData) {
                socket.emit('qr-code', qrCodeData);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`👋 Client disconnected: ${socket.id} (Remaining: ${io.sockets.sockets.size - 1})`);
    });
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
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

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WhatsApp Server running on port ${PORT}`);
    console.log(`📱 Node.js version: ${process.version}`);
    console.log(`📁 Auth directory: ${authDir}`);
    console.log(`🌍 Server ready at: http://localhost:${PORT}`);
    console.log('⏳ Ready for WhatsApp connection requests');
});