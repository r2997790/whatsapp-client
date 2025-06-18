const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const multer = require('multer');
const cors = require('cors');
const mime = require('mime-types');
const fsExtra = require('fs-extra');
const cron = require('node-cron');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Create necessary directories
const createDirectories = () => {
    const dirs = ['./auth_info_baileys', './data', './uploads'];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

createDirectories();

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Global variables
let sock = null;
let qrCodeData = null;
let isConnected = false;
let contacts = new Map();
let groups = new Map();
let messages = new Map();

// Data files
const DATA_FILES = {
    templates: './data/templates.json',
    contactGroups: './data/contact-groups.json',
    messages: './data/messages.json'
};

// Utility functions for data persistence
const loadData = (file) => {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (error) {
        console.error(`Error loading ${file}:`, error);
    }
    return [];
};

const saveData = (file, data) => {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error saving ${file}:`, error);
    }
};

// Logger
const logger = pino({ level: 'info' });// WhatsApp Connection Functions
const connectToWhatsApp = async () => {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp Web Client', 'Chrome', '4.0.0'],
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            defaultQueryTimeoutMs: 60 * 1000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                try {
                    qrCodeData = await QRCode.toDataURL(qr);
                    io.emit('qr-code', qrCodeData);
                    console.log('QR Code generated and sent to clients');
                } catch (error) {
                    console.error('Error generating QR code:', error);
                }
            }

            if (connection === 'close') {
                isConnected = false;
                io.emit('connection-status', { connected: false });
                
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
                
                if (shouldReconnect) {
                    setTimeout(() => connectToWhatsApp(), 5000);
                }
            } else if (connection === 'open') {
                isConnected = true;
                qrCodeData = null;
                console.log('WhatsApp connected successfully');
                io.emit('connection-status', { connected: true });
                
                // Load contacts and groups
                await loadContactsAndGroups();
            }
        });

        sock.ev.on('messages.upsert', async (messageUpdate) => {
            const { messages } = messageUpdate;
            
            for (const message of messages) {
                if (!message.key.fromMe) {
                    const messageData = {
                        id: message.key.id,
                        from: message.key.remoteJid,
                        message: message.message,
                        timestamp: message.messageTimestamp,
                        type: 'received'
                    };
                    
                    // Store message
                    storeMessage(messageData);
                    
                    // Emit to clients
                    io.emit('new-message', messageData);
                }
            }
        });

        sock.ev.on('presence.update', (presenceUpdate) => {
            io.emit('presence-update', presenceUpdate);
        });

    } catch (error) {
        console.error('Error connecting to WhatsApp:', error);
        setTimeout(() => connectToWhatsApp(), 10000);
    }
};

const loadContactsAndGroups = async () => {
    try {
        if (!sock) return;

        // Load contacts
        const contactsData = await sock.store?.contacts || {};
        contacts.clear();
        Object.entries(contactsData).forEach(([jid, contact]) => {
            if (jid.includes('@s.whatsapp.net')) {
                contacts.set(jid, {
                    jid,
                    name: contact.name || contact.notify || jid.split('@')[0],
                    notify: contact.notify,
                    verifiedName: contact.verifiedName
                });
            }
        });

        // Load groups
        const groupsData = await sock.groupFetchAllParticipating();
        groups.clear();
        Object.entries(groupsData).forEach(([jid, group]) => {
            groups.set(jid, {
                jid,
                subject: group.subject,
                desc: group.desc,
                participants: group.participants,
                creation: group.creation,
                owner: group.owner
            });
        });

        console.log(`Loaded ${contacts.size} contacts and ${groups.size} groups`);
        
        // Emit to clients
        io.emit('contacts-loaded', Array.from(contacts.values()));
        io.emit('groups-loaded', Array.from(groups.values()));
        
    } catch (error) {
        console.error('Error loading contacts and groups:', error);
    }
};

const storeMessage = (messageData) => {
    try {
        const messages = loadData(DATA_FILES.messages);
        messages.push(messageData);
        
        // Keep only last 1000 messages per chat
        const chatMessages = messages.filter(m => m.from === messageData.from);
        if (chatMessages.length > 1000) {
            const toRemove = chatMessages.slice(0, chatMessages.length - 1000);
            toRemove.forEach(msg => {
                const index = messages.findIndex(m => m.id === msg.id);
                if (index > -1) messages.splice(index, 1);
            });
        }
        
        saveData(DATA_FILES.messages, messages);
    } catch (error) {
        console.error('Error storing message:', error);
    }
};// API Routes

// Status and QR code endpoints
app.get('/api/status', (req, res) => {
    res.json({
        connected: isConnected,
        qrCode: qrCodeData,
        contacts: contacts.size,
        groups: groups.size
    });
});

app.get('/api/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qrCode: qrCodeData });
    } else {
        res.status(404).json({ error: 'No QR code available' });
    }
});

// Contacts and groups endpoints
app.get('/api/contacts', (req, res) => {
    res.json(Array.from(contacts.values()));
});

app.get('/api/groups', (req, res) => {
    res.json(Array.from(groups.values()));
});

// Messaging endpoints
app.post('/api/send-message', async (req, res) => {
    try {
        if (!sock || !isConnected) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        const { to, message, type = 'text' } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let result;
        
        if (type === 'text') {
            result = await sock.sendMessage(to, { text: message });
        } else {
            return res.status(400).json({ error: 'Unsupported message type' });
        }

        // Store sent message
        const messageData = {
            id: result.key.id,
            to: to,
            message: message,
            timestamp: Date.now(),
            type: 'sent',
            status: 'sent'
        };
        
        storeMessage(messageData);
        io.emit('message-sent', messageData);

        res.json({ success: true, messageId: result.key.id });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.post('/api/send-bulk', async (req, res) => {
    try {
        if (!sock || !isConnected) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        const { recipients, message, delay = 1000 } = req.body;
        
        if (!recipients || !Array.isArray(recipients) || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const results = [];
        
        for (let i = 0; i < recipients.length; i++) {
            try {
                const recipient = recipients[i];
                const result = await sock.sendMessage(recipient, { text: message });
                
                results.push({
                    recipient,
                    success: true,
                    messageId: result.key.id
                });

                // Store sent message
                const messageData = {
                    id: result.key.id,
                    to: recipient,
                    message: message,
                    timestamp: Date.now(),
                    type: 'sent',
                    status: 'sent'
                };
                
                storeMessage(messageData);
                io.emit('message-sent', messageData);
                
                // Delay between messages
                if (i < recipients.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
            } catch (error) {
                console.error(`Error sending to ${recipients[i]}:`, error);
                results.push({
                    recipient: recipients[i],
                    success: false,
                    error: error.message
                });
            }
        }

        res.json({ results });
    } catch (error) {
        console.error('Error sending bulk messages:', error);
        res.status(500).json({ error: 'Failed to send bulk messages' });
    }
});

app.get('/api/messages/:chatId', (req, res) => {
    try {
        const { chatId } = req.params;
        const allMessages = loadData(DATA_FILES.messages);
        const chatMessages = allMessages.filter(m => m.from === chatId || m.to === chatId);
        
        // Sort by timestamp
        chatMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        res.json(chatMessages);
    } catch (error) {
        console.error('Error loading messages:', error);
        res.status(500).json({ error: 'Failed to load messages' });
    }
});// File upload endpoints
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileInfo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path
        };

        res.json(fileInfo);
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

app.post('/api/send-media', async (req, res) => {
    try {
        if (!sock || !isConnected) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        const { to, filename, caption } = req.body;
        
        if (!to || !filename) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const filePath = path.join('./uploads', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        const fileBuffer = fs.readFileSync(filePath);

        let result;
        
        if (mimeType.startsWith('image/')) {
            result = await sock.sendMessage(to, {
                image: fileBuffer,
                caption: caption || '',
                mimetype: mimeType
            });
        } else if (mimeType.startsWith('video/')) {
            result = await sock.sendMessage(to, {
                video: fileBuffer,
                caption: caption || '',
                mimetype: mimeType
            });
        } else if (mimeType.startsWith('audio/')) {
            result = await sock.sendMessage(to, {
                audio: fileBuffer,
                mimetype: mimeType
            });
        } else {
            result = await sock.sendMessage(to, {
                document: fileBuffer,
                fileName: path.basename(filePath),
                mimetype: mimeType,
                caption: caption || ''
            });
        }

        // Store sent message
        const messageData = {
            id: result.key.id,
            to: to,
            message: caption || `File: ${path.basename(filePath)}`,
            timestamp: Date.now(),
            type: 'sent',
            mediaType: mimeType,
            filename: filename
        };
        
        storeMessage(messageData);
        io.emit('message-sent', messageData);

        res.json({ success: true, messageId: result.key.id });
    } catch (error) {
        console.error('Error sending media:', error);
        res.status(500).json({ error: 'Failed to send media' });
    }
});

// Template management endpoints
app.get('/api/templates', (req, res) => {
    try {
        const templates = loadData(DATA_FILES.templates);
        res.json(templates);
    } catch (error) {
        console.error('Error loading templates:', error);
        res.status(500).json({ error: 'Failed to load templates' });
    }
});

app.post('/api/templates', (req, res) => {
    try {
        const { name, content, variables } = req.body;
        
        if (!name || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const templates = loadData(DATA_FILES.templates);
        const newTemplate = {
            id: Date.now().toString(),
            name,
            content,
            variables: variables || [],
            createdAt: new Date().toISOString()
        };

        templates.push(newTemplate);
        saveData(DATA_FILES.templates, templates);

        res.json(newTemplate);
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

app.put('/api/templates/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, content, variables } = req.body;
        
        const templates = loadData(DATA_FILES.templates);
        const templateIndex = templates.findIndex(t => t.id === id);
        
        if (templateIndex === -1) {
            return res.status(404).json({ error: 'Template not found' });
        }

        templates[templateIndex] = {
            ...templates[templateIndex],
            name,
            content,
            variables,
            updatedAt: new Date().toISOString()
        };

        saveData(DATA_FILES.templates, templates);
        res.json(templates[templateIndex]);
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

app.delete('/api/templates/:id', (req, res) => {
    try {
        const { id } = req.params;
        const templates = loadData(DATA_FILES.templates);
        const filteredTemplates = templates.filter(t => t.id !== id);
        
        if (filteredTemplates.length === templates.length) {
            return res.status(404).json({ error: 'Template not found' });
        }

        saveData(DATA_FILES.templates, filteredTemplates);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});// Clean up old files periodically
cron.schedule('0 2 * * *', () => {
    console.log('Running cleanup task...');
    
    // Clean up old uploaded files (older than 7 days)
    const uploadsDir = './uploads';
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.mtime.getTime() < sevenDaysAgo) {
                fs.unlinkSync(filePath);
                console.log(`Deleted old file: ${file}`);
            }
        });
    }
    
    // Clean up old messages (keep only last 30 days)
    try {
        const messages = loadData(DATA_FILES.messages);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const filteredMessages = messages.filter(msg => msg.timestamp > thirtyDaysAgo);
        
        if (filteredMessages.length < messages.length) {
            saveData(DATA_FILES.messages, filteredMessages);
            console.log(`Cleaned up ${messages.length - filteredMessages.length} old messages`);
        }
    } catch (error) {
        console.error('Error cleaning up messages:', error);
    }
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
    console.log(`WhatsApp Web Client server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
    
    // Initialize WhatsApp connection
    console.log('Initializing WhatsApp connection...');
    await connectToWhatsApp();
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    cleanup();
});

module.exports = { app, server, io };