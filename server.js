const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');

// Baileys imports with specific working configuration
const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore
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

// State
let sock;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let authDir;
let retryCount = 0;
const MAX_RETRIES = 3;

// Create fresh auth directory
function createFreshAuthDir() {
    authDir = path.join(tmpdir(), 'wa_auth_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }
    console.log('📁 Created fresh auth dir:', authDir);
    return authDir;
}

// Silent logger
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
        console.log('⚠️ Already connecting...');
        return;
    }

    try {
        isConnecting = true;
        retryCount++;
        console.log(`🔄 Starting WhatsApp connection attempt ${retryCount}...`);

        // Clean up existing socket completely
        if (sock) {
            try {
                console.log('🧹 Cleaning up existing socket...');
                sock.end();
                sock.ev.removeAllListeners();
                sock = null;
            } catch (e) {
                console.log('Socket cleanup error:', e.message);
            }
        }

        // Create completely fresh auth directory for each attempt
        const currentAuthDir = createFreshAuthDir();

        // Get latest Baileys version for better compatibility
        let version;
        try {
            const versionInfo = await fetchLatestBaileysVersion();
            version = versionInfo.version;
            console.log('📱 Using Baileys version:', version);
        } catch (error) {
            console.log('⚠️ Could not fetch version, using default');
            // Use a known working version as fallback
            version = [2, 2413, 1];
        }

        // Initialize auth state
        console.log('🔐 Initializing auth state...');
        const { state, saveCreds } = await useMultiFileAuthState(currentAuthDir);

        // Create socket with enhanced compatibility settings
        console.log('🔌 Creating socket with enhanced settings...');
        sock = makeWASocket({
            version: version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            printQRInTerminal: false,
            logger: logger,
            // Use macOS Chrome for better compatibility
            browser: ['Mac OS', 'Chrome', '103.0.5060.53'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            qrTimeout: 60000,
            // Enhanced settings for authentication
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            fireInitQueries: true,
            emitOwnEvents: false,
            shouldSyncHistoryMessage: msg => false,
            shouldIgnoreJid: jid => false,
            linkPreviewImageThumbnailWidth: 192,
            transactionOpts: {
                maxCommitRetries: 5,
                delayBetweenTriesMs: 3000
            },
            getMessage: async (key) => {
                return {
                    conversation: 'Hello, this is a WhatsApp client!'
                };
            }
        });

        console.log('✅ Socket created with enhanced configuration');

        // Enhanced connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin, isOnline } = update;
            
            console.log('📡 Connection update:', {
                connection,
                qr: !!qr,
                isNewLogin,
                isOnline,
                lastDisconnectCode: lastDisconnect?.error?.output?.statusCode,
                lastDisconnectMsg: lastDisconnect?.error?.message
            });

            if (qr) {
                try {
                    console.log('📱 QR received, generating image...');
                    
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
                    console.log('✅ QR generated, length:', qrCodeData.length);
                    
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    
                    console.log('📤 QR sent to', io.sockets.sockets.size, 'clients');
                } catch (error) {
                    console.error('❌ QR generation error:', error);
                    connectionStatus = 'error';
                    io.emit('connection-status', connectionStatus);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMsg = lastDisconnect?.error?.message;
                
                console.log('🔌 Connection closed:');
                console.log('  - Status Code:', statusCode);
                console.log('  - Error Message:', errorMsg);
                console.log('  - Retry Count:', retryCount);
                
                connectionStatus = 'disconnected';
                qrCodeData = null;
                isConnecting = false;
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);

                // Enhanced disconnect handling with backoff
                let shouldRetry = false;
                let retryDelay = 5000;

                switch (statusCode) {
                    case DisconnectReason.badSession:
                        console.log('❌ Bad session detected');
                        shouldRetry = retryCount < MAX_RETRIES;
                        retryDelay = 2000;
                        break;
                    case DisconnectReason.connectionClosed:
                        console.log('🔄 Connection closed by server');
                        shouldRetry = retryCount < MAX_RETRIES;
                        retryDelay = 3000;
                        break;
                    case DisconnectReason.connectionLost:
                        console.log('📡 Connection lost');
                        shouldRetry = retryCount < MAX_RETRIES;
                        retryDelay = 5000;
                        break;
                    case DisconnectReason.connectionReplaced:
                        console.log('🔄 Connection replaced - not retrying');
                        retryCount = MAX_RETRIES; // Stop retrying
                        break;
                    case DisconnectReason.loggedOut:
                        console.log('🚫 Logged out - manual reconnect required');
                        retryCount = MAX_RETRIES; // Stop retrying
                        break;
                    case DisconnectReason.restartRequired:
                        console.log('🔄 Restart required');
                        shouldRetry = true;
                        retryDelay = 1000;
                        break;
                    case DisconnectReason.timedOut:
                        console.log('⏰ Connection timed out');
                        shouldRetry = retryCount < MAX_RETRIES;
                        retryDelay = 8000;
                        break;
                    case DisconnectReason.multideviceMismatch:
                        console.log('📱 Multi-device mismatch');
                        shouldRetry = retryCount < MAX_RETRIES;
                        retryDelay = 3000;
                        break;
                    default:
                        if (statusCode === 401) {
                            console.log('🔑 Authentication failed - QR might be expired');
                            shouldRetry = retryCount < MAX_RETRIES;
                            retryDelay = 2000;
                        } else if (statusCode === 403) {
                            console.log('🚫 Forbidden - might be rate limited');
                            shouldRetry = retryCount < 2; // Fewer retries for 403
                            retryDelay = 15000; // Longer delay
                        } else if (statusCode) {
                            console.log(`❓ Unknown error code: ${statusCode}`);
                            shouldRetry = retryCount < MAX_RETRIES;
                            retryDelay = 10000;
                        } else {
                            console.log('❓ No error code - unexpected disconnect');
                            // This is the key fix - when QR is scanned but auth fails silently
                            shouldRetry = retryCount < MAX_RETRIES;
                            retryDelay = 5000;
                        }
                        break;
                }

                if (shouldRetry) {
                    console.log(`🔄 Will retry in ${retryDelay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, retryDelay);
                } else {
                    console.log('🛑 Max retries reached or permanent error - stopping');
                    retryCount = 0; // Reset for manual reconnection
                }
                
            } else if (connection === 'open') {
                console.log('✅ CONNECTION SUCCESSFUL! 🎉');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                retryCount = 0; // Reset retry count on success
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
            } else if (connection === 'connecting') {
                console.log('🔗 Authenticating with WhatsApp...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
            }
        });

        // Enhanced credentials handler
        sock.ev.on('creds.update', (creds) => {
            console.log('🔐 Credentials updated - saving...');
            saveCreds(creds);
        });

        // Additional event handlers for stability
        sock.ev.on('messages.upsert', async (m) => {
            console.log('📨 Messages received:', m.messages.length);
        });

        sock.ev.on('chats.set', ({ chats }) => {
            console.log('💬 Chats synced:', chats.length);
        });

        sock.ev.on('contacts.set', ({ contacts }) => {
            console.log('👥 Contacts synced:', Object.keys(contacts).length);
        });

        console.log('✅ All event handlers registered successfully');

    } catch (error) {
        console.error('❌ Connection setup failed:', error);
        console.error('Stack trace:', error.stack);
        
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
        
        // Retry with exponential backoff
        if (retryCount < MAX_RETRIES) {
            const retryDelay = Math.min(5000 * Math.pow(2, retryCount - 1), 30000);
            console.log(`🔄 Setup failed, retrying in ${retryDelay}ms...`);
            setTimeout(() => {
                connectToWhatsApp();
            }, retryDelay);
        } else {
            console.log('🛑 Setup failed too many times - stopping');
            retryCount = 0;
        }
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
        retry_count: retryCount,
        auth_dir: authDir,
        has_qr: !!qrCodeData
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        hasQR: !!qrCodeData,
        isConnecting: isConnecting,
        retryCount: retryCount
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

        console.log(`📤 Sending to ${formattedNumber}: ${message.substring(0, 50)}...`);
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
                results.push({ number, success: false, error: error.message });
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Bulk send completed',
            results: results 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send bulk messages' });
    }
});

// Reset connection endpoint
app.post('/api/reset', (req, res) => {
    console.log('🔄 Manual reset requested');
    retryCount = 0;
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
        connectToWhatsApp();
        res.json({ success: true, message: 'Reset initiated' });
    } else {
        res.json({ success: false, message: 'Already connected or connecting' });
    }
});

// Socket.io
io.on('connection', (socket) => {
    console.log(`👤 Client connected: ${socket.id} (Total: ${io.sockets.sockets.size})`);
    
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
    }

    socket.on('connect-whatsapp', () => {
        console.log('🔌 Client requested connection');
        retryCount = 0; // Reset retry count on manual request
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            connectToWhatsApp();
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
    console.log('⏳ Ready for WhatsApp connections');
    console.log('🔧 Enhanced authentication handling enabled');
});