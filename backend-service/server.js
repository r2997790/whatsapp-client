const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// CRITICAL: Fix crypto issue for Baileys
const crypto = require('crypto');
if (!global.crypto) {
    global.crypto = crypto;
}

// Import Baileys after crypto fix
const { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Global state
let currentQR = null;
let connectionStatus = 'disconnected';
let socket_global = null;
let connections = new Map();

// Ensure auth directory exists
const authDir = path.join(__dirname, 'auth');
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('Created auth directory:', authDir);
}

async function startWhatsApp() {
    try {
        console.log('🚀 Starting WhatsApp connection...');
        console.log('📁 Auth directory:', authDir);
        
        connectionStatus = 'connecting';
        io.emit('status_update', { status: connectionStatus });

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('✅ Auth state loaded');
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
            defaultQueryTimeoutMs: 60000,
        });

        socket_global = sock;
        connections.set('main', sock);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log('📱 Connection update:', { 
                connection, 
                hasQR: !!qr,
                error: lastDisconnect?.error?.message 
            });
            
            if (qr) {
                try {
                    console.log('🔄 Generating QR code...');
                    currentQR = await QRCode.toDataURL(qr);
                    connectionStatus = 'qr_ready';
                    
                    // Emit to all connected clients
                    io.emit('qr_updated', { qr: currentQR, status: connectionStatus });
                    io.emit('status_update', { status: connectionStatus });
                    
                    console.log('✅ QR Code generated and sent to', io.engine.clientsCount, 'clients');
                } catch (err) {
                    console.error('❌ Error generating QR:', err);
                    connectionStatus = 'error';
                    io.emit('status_update', { status: connectionStatus, error: err.message });
                }
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut;
                console.log('❌ Connection closed:', lastDisconnect?.error?.message, 'Reconnecting:', shouldReconnect);
                
                currentQR = null;
                
                if (shouldReconnect) {
                    connectionStatus = 'reconnecting';
                    io.emit('status_update', { status: connectionStatus });
                    setTimeout(startWhatsApp, 3000);
                } else {
                    connectionStatus = 'disconnected';
                    io.emit('status_update', { status: connectionStatus });
                }
            } else if (connection === 'open') {
                connectionStatus = 'connected';
                currentQR = null;
                io.emit('status_update', { 
                    status: connectionStatus, 
                    user: sock.user 
                });
                console.log('✅ Successfully connected to WhatsApp as:', sock.user?.name || 'Unknown');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        sock.ev.on('messages.upsert', (m) => {
            const messages = m.messages || [];
            for (const message of messages) {
                if (!message.key.fromMe) {
                    io.emit('message_received', {
                        from: message.key.remoteJid,
                        message: message.message,
                        timestamp: message.messageTimestamp
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('💥 Error starting WhatsApp:', error);
        connectionStatus = 'error';
        io.emit('status_update', { status: connectionStatus, error: error.message });
        
        // Retry after delay
        setTimeout(startWhatsApp, 5000);
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id, '(Total:', io.engine.clientsCount, 'clients)');
    
    // Send current status to new client
    socket.emit('status_update', { 
        status: connectionStatus,
        qr: currentQR,
        timestamp: Date.now()
    });

    socket.on('reconnect_whatsapp', () => {
        console.log('🔄 Manual reconnection requested by client:', socket.id);
        if (socket_global) {
            socket_global.end();
        }
        currentQR = null;
        connectionStatus = 'reconnecting';
        io.emit('status_update', { status: connectionStatus });
        setTimeout(startWhatsApp, 1000);
    });

    socket.on('send_message', async (data) => {
        try {
            const sock = connections.get('main');
            if (sock && connectionStatus === 'connected') {
                const { to, message } = data;
                await sock.sendMessage(to, { text: message });
                socket.emit('message_sent', { to, message, timestamp: Date.now() });
                console.log('📤 Message sent to:', to);
            } else {
                socket.emit('error', { message: 'WhatsApp not connected' });
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message: ' + error.message });
        }
    });

    socket.on('send_bulk_message', async (data) => {
        try {
            const sock = connections.get('main');
            if (sock && connectionStatus === 'connected') {
                const { contacts, message } = data;
                const results = [];
                
                console.log('📤 Starting bulk message to', contacts.length, 'contacts');
                
                for (const contact of contacts) {
                    try {
                        await sock.sendMessage(contact, { text: message });
                        results.push({ contact, status: 'sent' });
                        console.log('✅ Sent to:', contact);
                        // Rate limiting
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        results.push({ contact, status: 'failed', error: error.message });
                        console.log('❌ Failed to send to:', contact, error.message);
                    }
                }
                
                socket.emit('bulk_message_complete', results);
                console.log('📊 Bulk message complete:', results.length, 'total');
            } else {
                socket.emit('error', { message: 'WhatsApp not connected' });
            }
        } catch (error) {
            console.error('❌ Error sending bulk message:', error);
            socket.emit('error', { message: 'Failed to send bulk message: ' + error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id, '(Remaining:', io.engine.clientsCount - 1, 'clients)');
    });
});

// REST API Endpoints
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        whatsapp_status: connectionStatus,
        timestamp: Date.now(),
        clients_connected: io.engine.clientsCount,
        has_qr: !!currentQR,
        version: '2.0.0'
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        qr: currentQR,
        timestamp: Date.now(),
        clients_connected: io.engine.clientsCount
    });
});

app.get('/api/qr', (req, res) => {
    if (currentQR) {
        res.json({ qr: currentQR, status: connectionStatus });
    } else {
        res.status(404).json({ 
            error: 'No QR code available', 
            status: connectionStatus,
            message: 'Try clicking Connect WhatsApp button'
        });
    }
});

app.post('/api/force-reconnect', (req, res) => {
    console.log('🔄 Force reconnect requested via API');
    if (socket_global) {
        socket_global.end();
    }
    currentQR = null;
    connectionStatus = 'reconnecting';
    io.emit('status_update', { status: connectionStatus });
    setTimeout(startWhatsApp, 1000);
    res.json({ message: 'Reconnection initiated', status: connectionStatus });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    if (socket_global) {
        socket_global.end();
    }
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('🚀 WhatsApp service running on port', PORT);
    console.log('📦 Node.js version:', process.version);
    console.log('🔐 Crypto available:', !!crypto);
    console.log('📁 Auth directory:', authDir);
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    
    // Start WhatsApp connection after server is ready
    setTimeout(() => {
        console.log('⏳ Initializing WhatsApp connection in 3 seconds...');
        setTimeout(startWhatsApp, 3000);
    }, 1000);
});
