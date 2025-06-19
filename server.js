const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');

// Baileys imports
const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    delay
} = require('@whiskeysockets/baileys');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
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

// Auth storage
const authDir = path.join(tmpdir(), 'baileys_auth_session');

// Ensure directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
}

// Logger - completely silent
const logger = {
    level: 'silent',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

async function startWhatsApp() {
    if (isConnecting) return;
    
    try {
        isConnecting = true;
        console.log('🔄 Starting WhatsApp...');

        // Clear any existing socket
        if (sock) {
            sock.end();
            sock = null;
        }

        // Clear auth directory for fresh session
        try {
            const files = fs.readdirSync(authDir);
            files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
            console.log('🧹 Cleared auth directory');
        } catch (e) {}

        // Initialize auth
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket with absolute minimal config
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            // Use no version - let Baileys decide
            getMessage: async () => ({ conversation: 'hello' })
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log('📡 Update:', { connection, qr: !!qr, code: lastDisconnect?.error?.output?.statusCode });

            if (qr) {
                try {
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 2,
                        color: { dark: '#000000', light: '#FFFFFF' }
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ QR sent');
                } catch (error) {
                    console.error('❌ QR error:', error);
                    connectionStatus = 'error';
                    io.emit('connection-status', connectionStatus);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('🔌 Closed:', statusCode);
                
                connectionStatus = 'disconnected';
                qrCodeData = null;
                isConnecting = false;
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);

                // Simple reconnection logic
                if (statusCode !== DisconnectReason.loggedOut && 
                    statusCode !== DisconnectReason.connectionReplaced) {
                    setTimeout(startWhatsApp, 3000);
                }
            } else if (connection === 'open') {
                console.log('✅ CONNECTED!');
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

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('❌ Error:', error);
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
        
        setTimeout(startWhatsApp, 10000);
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
        timestamp: new Date().toISOString()
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
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        let formattedNumber = number.toString().replace(/[^\d]/g, '');
        if (!formattedNumber.includes('@')) {
            formattedNumber = `${formattedNumber}@s.whatsapp.net`;
        }

        await sock.sendMessage(formattedNumber, { text: message });
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Send error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.post('/api/send-bulk', async (req, res) => {
    try {
        const { numbers, message } = req.body;
        
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

// Socket.io
io.on('connection', (socket) => {
    console.log(`👤 Client connected: ${socket.id}`);
    
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
    }

    socket.on('connect-whatsapp', () => {
        console.log('🔌 Client requested connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            startWhatsApp();
        }
    });

    socket.on('disconnect', () => {
        console.log(`👋 Client disconnected: ${socket.id}`);
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('⏳ Ready for connections');
});