const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');

// Import Baileys 6.4.0 - known stable version
const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    delay,
    Browsers
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

// Global state
let sock;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let authDir;

// Create new auth directory for each session
function createAuthDir() {
    authDir = path.join(tmpdir(), 'wa_session_' + Date.now());
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }
    console.log('📁 Created fresh auth directory:', authDir);
    return authDir;
}

// Minimal logger for Baileys
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
        console.log('⚠️ Connection already in progress');
        return;
    }

    try {
        isConnecting = true;
        console.log('🔄 Starting WhatsApp connection process...');

        // Clean up any existing socket
        if (sock) {
            try {
                sock.end();
                sock = null;
                console.log('🧹 Cleaned up existing socket');
            } catch (e) {
                console.log('Socket cleanup error:', e.message);
            }
        }

        // Create completely fresh auth directory
        const currentAuthDir = createAuthDir();

        // Initialize auth state
        console.log('🔐 Initializing auth state...');
        const { state, saveCreds } = await useMultiFileAuthState(currentAuthDir);

        // Create socket with minimal configuration
        console.log('🔌 Creating WhatsApp socket...');
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            // Use the most basic browser config
            browser: Browsers.ubuntu('Chrome'),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            // Minimal options to reduce complexity
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            fireInitQueries: false,
            emitOwnEvents: false,
            // Specific version that works
            version: [2, 2412, 54],
            getMessage: async (key) => {
                return {
                    conversation: 'hello'
                };
            }
        });

        console.log('✅ Socket created successfully');

        // Set up event handlers with detailed logging
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin, isOnline, receivedPendingNotifications } = update;
            
            console.log('📡 Connection update received:', {
                connection,
                qr: !!qr,
                isNewLogin,
                isOnline,
                receivedPendingNotifications,
                lastDisconnectCode: lastDisconnect?.error?.output?.statusCode,
                lastDisconnectMessage: lastDisconnect?.error?.message
            });

            if (qr) {
                try {
                    console.log('📱 QR code received, length:', qr.length);
                    
                    // Generate QR with highest quality settings
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 12,
                        margin: 4,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        },
                        errorCorrectionLevel: 'H',
                        type: 'image/png',
                        quality: 1,
                        width: 512
                    });
                    
                    connectionStatus = 'qr-ready';
                    console.log('✅ QR Code generated successfully, data length:', qrCodeData.length);
                    
                    // Broadcast to all clients
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    
                    console.log('📤 QR code broadcasted to', io.sockets.sockets.size, 'client(s)');
                } catch (error) {
                    console.error('❌ QR generation error:', error);
                    connectionStatus = 'error';
                    io.emit('connection-status', connectionStatus);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message;
                
                console.log('🔌 Connection closed:');
                console.log('  - Status Code:', statusCode);
                console.log('  - Error Message:', errorMessage);
                console.log('  - Full Error:', lastDisconnect?.error);
                
                connectionStatus = 'disconnected';
                qrCodeData = null;
                isConnecting = false;
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);

                // Handle different disconnect reasons with detailed logging
                switch (statusCode) {
                    case DisconnectReason.badSession:
                        console.log('❌ Bad session - will clear auth and retry');
                        setTimeout(() => connectToWhatsApp(), 3000);
                        break;
                    case DisconnectReason.connectionClosed:
                        console.log('🔄 Connection closed - will retry');
                        setTimeout(() => connectToWhatsApp(), 5000);
                        break;
                    case DisconnectReason.connectionLost:
                        console.log('📡 Connection lost - will retry');
                        setTimeout(() => connectToWhatsApp(), 5000);
                        break;
                    case DisconnectReason.connectionReplaced:
                        console.log('🔄 Connection replaced - stopping reconnection');
                        break;
                    case DisconnectReason.loggedOut:
                        console.log('🚫 Logged out - manual reconnection required');
                        break;
                    case DisconnectReason.restartRequired:
                        console.log('🔄 Restart required - will retry');
                        setTimeout(() => connectToWhatsApp(), 2000);
                        break;
                    case DisconnectReason.timedOut:
                        console.log('⏰ Connection timed out - will retry');
                        setTimeout(() => connectToWhatsApp(), 5000);
                        break;
                    case DisconnectReason.multideviceMismatch:
                        console.log('📱 Multi-device mismatch - will retry with fresh session');
                        setTimeout(() => connectToWhatsApp(), 3000);
                        break;
                    default:
                        if (statusCode) {
                            console.log(`❓ Unknown disconnect reason (${statusCode}) - will retry`);
                            setTimeout(() => connectToWhatsApp(), 5000);
                        } else {
                            console.log('❓ No status code - unexpected disconnect');
                        }
                        break;
                }
                
            } else if (connection === 'open') {
                console.log('✅ CONNECTION SUCCESSFUL! WhatsApp authenticated.');
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

        // Enhanced credentials update handler
        sock.ev.on('creds.update', (creds) => {
            console.log('🔐 Credentials updated');
            saveCreds(creds);
        });

        // Message handler with logging
        sock.ev.on('messages.upsert', async (m) => {
            console.log('📨 Messages received:', m.messages.length);
        });

        // Additional event handlers for debugging
        sock.ev.on('chats.set', (chats) => {
            console.log('💬 Chats loaded:', chats.length);
        });

        sock.ev.on('contacts.set', (contacts) => {
            console.log('👥 Contacts loaded:', Object.keys(contacts).length);
        });

        console.log('✅ All event handlers registered');

    } catch (error) {
        console.error('❌ Connection setup failed:', error);
        console.error('Error stack:', error.stack);
        
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
        
        // Retry with longer delay
        console.log('🔄 Will retry in 15 seconds...');
        setTimeout(() => {
            connectToWhatsApp();
        }, 15000);
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
        connected_clients: io.sockets.sockets.size,
        is_connecting: isConnecting
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        hasQR: !!qrCodeData,
        isConnecting: isConnecting,
        timestamp: new Date().toISOString(),
        authDir: authDir
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

// Socket.io
io.on('connection', (socket) => {
    console.log(`👤 Client connected: ${socket.id} (Total: ${io.sockets.sockets.size})`);
    
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

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WhatsApp Server running on port ${PORT}`);
    console.log(`📱 Node.js version: ${process.version}`);
    console.log(`🌍 Server ready at: http://localhost:${PORT}`);
    console.log('⏳ Ready for WhatsApp connection requests');
    console.log('🔧 Using Baileys 6.4.0 with enhanced logging');
});