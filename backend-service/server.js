const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

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

// Store active connections
const connections = new Map();
let currentQR = null;
let connectionStatus = 'disconnected';
let socket_global = null;

// Ensure auth directory exists
const authDir = path.join(__dirname, 'auth');
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
}

async function startWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
        });

        socket_global = sock;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log('Connection update:', { connection, qr: !!qr });
            
            if (qr) {
                try {
                    currentQR = await QRCode.toDataURL(qr);
                    connectionStatus = 'qr_ready';
                    io.emit('qr_updated', { qr: currentQR, status: connectionStatus });
                    console.log('QR Code generated and sent to clients');
                } catch (err) {
                    console.error('Error generating QR:', err);
                }
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut;
                console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                
                if (shouldReconnect) {
                    connectionStatus = 'reconnecting';
                    io.emit('status_update', { status: connectionStatus });
                    setTimeout(startWhatsApp, 3000);
                } else {
                    connectionStatus = 'disconnected';
                    currentQR = null;
                    io.emit('status_update', { status: connectionStatus });
                }
            } else if (connection === 'open') {
                connectionStatus = 'connected';
                currentQR = null;
                io.emit('status_update', { 
                    status: connectionStatus, 
                    user: sock.user 
                });
                console.log('Successfully connected to WhatsApp');
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

        connections.set('main', sock);
        
    } catch (error) {
        console.error('Error starting WhatsApp:', error);
        connectionStatus = 'error';
        io.emit('status_update', { status: connectionStatus, error: error.message });
        setTimeout(startWhatsApp, 5000);
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send current status to new client
    socket.emit('status_update', { 
        status: connectionStatus,
        qr: currentQR 
    });

    socket.on('get_contacts', async () => {
        try {
            const sock = connections.get('main');
            if (sock && connectionStatus === 'connected') {
                const contacts = await sock.getContacts();
                socket.emit('contacts_list', contacts);
            }
        } catch (error) {
            socket.emit('error', { message: 'Failed to get contacts' });
        }
    });

    socket.on('send_message', async (data) => {
        try {
            const sock = connections.get('main');
            if (sock && connectionStatus === 'connected') {
                const { to, message } = data;
                await sock.sendMessage(to, { text: message });
                socket.emit('message_sent', { to, message, timestamp: Date.now() });
            } else {
                socket.emit('error', { message: 'WhatsApp not connected' });
            }
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    socket.on('send_bulk_message', async (data) => {
        try {
            const sock = connections.get('main');
            if (sock && connectionStatus === 'connected') {
                const { contacts, message } = data;
                const results = [];
                
                for (const contact of contacts) {
                    try {
                        await sock.sendMessage(contact, { text: message });
                        results.push({ contact, status: 'sent' });
                        // Add delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        results.push({ contact, status: 'failed', error: error.message });
                    }
                }
                
                socket.emit('bulk_message_complete', results);
            } else {
                socket.emit('error', { message: 'WhatsApp not connected' });
            }
        } catch (error) {
            console.error('Error sending bulk message:', error);
            socket.emit('error', { message: 'Failed to send bulk message' });
        }
    });

    socket.on('reconnect_whatsapp', () => {
        console.log('Manual reconnection requested');
        if (socket_global) {
            socket_global.end();
        }
        setTimeout(startWhatsApp, 1000);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// REST API Endpoints
app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        qr: currentQR,
        timestamp: Date.now()
    });
});

app.get('/api/qr', (req, res) => {
    if (currentQR) {
        res.json({ qr: currentQR, status: connectionStatus });
    } else {
        res.status(404).json({ error: 'No QR code available' });
    }
});

app.post('/api/send-message', async (req, res) => {
    try {
        const { to, message } = req.body;
        const sock = connections.get('main');
        
        if (sock && connectionStatus === 'connected') {
            await sock.sendMessage(to, { text: message });
            res.json({ success: true, message: 'Message sent' });
        } else {
            res.status(400).json({ error: 'WhatsApp not connected' });
        }
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        whatsapp_status: connectionStatus,
        timestamp: Date.now() 
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    if (socket_global) {
        socket_global.end();
    }
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`WhatsApp service running on port ${PORT}`);
    // Start WhatsApp connection
    startWhatsApp();
});
