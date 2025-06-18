const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');

// Import Baileys
const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    isJidBroadcast,
    isJidGroup,
    jidNormalizedUser,
    getAggregateVotesInPollMessage
} = require('@whiskeysockets/baileys');

const P = require('pino');

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

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Global variables
let sock;
let qrCodeData = null;
let isConnected = false;
let authState;
let store;
let contacts = {};
let groups = {};
let messages = {};
let templates = [];
let contactGroups = [];

// Initialize store
const initStore = () => {
    store = makeInMemoryStore({ logger: P().child({ level: 'silent', stream: 'store' }) });
    store.readFromFile('./baileys_store_multi.json');
    
    // Save store every 10 seconds
    setInterval(() => {
        store.writeToFile('./baileys_store_multi.json');
    }, 10_000);
};

// Load saved data
const loadSavedData = async () => {
    try {
        // Load templates
        if (await fs.pathExists('./data/templates.json')) {
            templates = await fs.readJSON('./data/templates.json');
        }
        
        // Load contact groups
        if (await fs.pathExists('./data/contact-groups.json')) {
            contactGroups = await fs.readJSON('./data/contact-groups.json');
        }
        
        // Load messages
        if (await fs.pathExists('./data/messages.json')) {
            messages = await fs.readJSON('./data/messages.json');
        }
    } catch (error) {
        console.error('Error loading saved data:', error);
    }
};

// Save data
const saveData = async () => {
    try {
        await fs.ensureDir('./data');
        await fs.writeJSON('./data/templates.json', templates);
        await fs.writeJSON('./data/contact-groups.json', contactGroups);
        await fs.writeJSON('./data/messages.json', messages);
    } catch (error) {
        console.error('Error saving data:', error);
    }
};

// Initialize WhatsApp connection
const connectToWhatsApp = async () => {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
        authState = state;
        
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

        sock = makeWASocket({
            version,
            logger: P({ level: 'warn' }),
            printQRInTerminal: false,
            auth: authState,
            browser: ["WhatsApp Client", "Chrome", "1.0.0"],
            generateHighQualityLinkPreview: true
        });

        // Bind store to socket events
        if (store) {
            store.bind(sock.ev);
        }

        // Connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrCodeData = qr;
                io.emit('qr-code', qr);
                console.log('QR Code generated');
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                isConnected = false;
                io.emit('connection-status', { connected: false });
                console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                
                if (shouldReconnect) {
                    setTimeout(connectToWhatsApp, 3000);
                }
            } else if (connection === 'open') {
                isConnected = true;
                qrCodeData = null;
                io.emit('connection-status', { connected: true });
                io.emit('qr-code', null);
                console.log('WhatsApp connected successfully');
                
                // Load contacts and groups
                await loadContactsAndGroups();
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        sock.ev.on('messages.upsert', async (m) => {
            const message = m.messages[0];
            if (!message.key.fromMe && m.type === 'notify') {
                console.log('Received message:', message);
                
                // Store message
                const chatId = message.key.remoteJid;
                if (!messages[chatId]) {
                    messages[chatId] = [];
                }
                messages[chatId].push({
                    id: message.key.id,
                    from: message.key.fromMe ? 'me' : chatId,
                    to: message.key.fromMe ? chatId : 'me',
                    message: message.message,
                    timestamp: message.messageTimestamp,
                    type: 'received'
                });
                
                // Emit to frontend
                io.emit('new-message', {
                    chatId,
                    message: message.message,
                    from: message.key.fromMe ? 'me' : chatId,
                    timestamp: message.messageTimestamp
                });
                
                await saveData();
            }
        });

        // Handle message status updates
        sock.ev.on('message-receipt.update', (updates) => {
            updates.forEach(({ key, receipt }) => {
                console.log('Message receipt update:', { key, receipt });
                io.emit('message-status', { key, receipt });
            });
        });

        // Handle presence updates
        sock.ev.on('presence.update', ({ id, presences }) => {
            io.emit('presence-update', { id, presences });
        });

    } catch (error) {
        console.error('Error connecting to WhatsApp:', error);
        setTimeout(connectToWhatsApp, 5000);
    }
};

// Load contacts and groups
const loadContactsAndGroups = async () => {
    try {
        if (sock && isConnected) {
            // Get contacts
            const contactList = await sock.getContactList();
            contacts = {};
            contactList.forEach(contact => {
                contacts[contact.id] = {
                    id: contact.id,
                    name: contact.name || contact.notify || contact.id.replace('@s.whatsapp.net', ''),
                    notify: contact.notify,
                    status: contact.status
                };
            });
            
            // Get groups
            const groupList = await sock.groupFetchAllParticipating();
            groups = {};
            Object.keys(groupList).forEach(groupId => {
                const group = groupList[groupId];
                groups[groupId] = {
                    id: groupId,
                    name: group.subject,
                    participants: group.participants,
                    description: group.desc,
                    creation: group.creation,
                    owner: group.owner
                };
            });
            
            io.emit('contacts-updated', contacts);
            io.emit('groups-updated', groups);
            console.log(`Loaded ${Object.keys(contacts).length} contacts and ${Object.keys(groups).length} groups`);
        }
    } catch (error) {
        console.error('Error loading contacts and groups:', error);
    }
};

// API Routes

// Get connection status
app.get('/api/status', (req, res) => {
    res.json({ 
        connected: isConnected, 
        qrCode: qrCodeData,
        contacts: Object.keys(contacts).length,
        groups: Object.keys(groups).length
    });
});

// Get QR code
app.get('/api/qr', (req, res) => {
    res.json({ qrCode: qrCodeData });
});

// Get contacts
app.get('/api/contacts', (req, res) => {
    res.json(contacts);
});

// Get groups
app.get('/api/groups', (req, res) => {
    res.json(groups);
});

// Get messages for a chat
app.get('/api/messages/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    const chatMessages = messages[chatId] || [];
    res.json(chatMessages);
});

// Send message
app.post('/api/send-message', async (req, res) => {
    try {
        const { to, message, type = 'text', mediaUrl, fileName, caption } = req.body;
        
        if (!isConnected) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        let result;
        
        switch (type) {
            case 'text':
                result = await sock.sendMessage(to, { text: message });
                break;
                
            case 'image':
                if (mediaUrl) {
                    result = await sock.sendMessage(to, { 
                        image: { url: mediaUrl }, 
                        caption: caption || '' 
                    });
                }
                break;
                
            case 'video':
                if (mediaUrl) {
                    result = await sock.sendMessage(to, { 
                        video: { url: mediaUrl }, 
                        caption: caption || '' 
                    });
                }
                break;
                
            case 'document':
                if (mediaUrl) {
                    result = await sock.sendMessage(to, { 
                        document: { url: mediaUrl }, 
                        fileName: fileName || 'document',
                        caption: caption || '' 
                    });
                }
                break;
                
            case 'audio':
                if (mediaUrl) {
                    result = await sock.sendMessage(to, { 
                        audio: { url: mediaUrl }, 
                        mimetype: 'audio/mp4'
                    });
                }
                break;
        }
        
        // Store sent message
        if (!messages[to]) {
            messages[to] = [];
        }
        messages[to].push({
            id: result.key.id,
            from: 'me',
            to: to,
            message: { text: message } || { caption: caption },
            timestamp: Date.now(),
            type: 'sent'
        });
        
        await saveData();
        
        res.json({ success: true, messageId: result.key.id });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send bulk messages
app.post('/api/send-bulk', async (req, res) => {
    try {
        const { recipients, message, type = 'text', delay = 1000 } = req.body;
        
        if (!isConnected) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }
        
        const results = [];
        
        for (const recipient of recipients) {
            try {
                await new Promise(resolve => setTimeout(resolve, delay));
                
                const result = await sock.sendMessage(recipient, { text: message });
                results.push({ recipient, success: true, messageId: result.key.id });
                
                // Store sent message
                if (!messages[recipient]) {
                    messages[recipient] = [];
                }
                messages[recipient].push({
                    id: result.key.id,
                    from: 'me',
                    to: recipient,
                    message: { text: message },
                    timestamp: Date.now(),
                    type: 'sent'
                });
                
            } catch (error) {
                results.push({ recipient, success: false, error: error.message });
            }
        }
        
        await saveData();
        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload file
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ 
        success: true, 
        fileUrl: fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
    });
});

// Get templates
app.get('/api/templates', (req, res) => {
    res.json(templates);
});

// Create template
app.post('/api/templates', async (req, res) => {
    try {
        const { name, content, variables = [] } = req.body;
        
        const template = {
            id: Date.now().toString(),
            name,
            content,
            variables,
            createdAt: new Date().toISOString()
        };
        
        templates.push(template);
        await saveData();
        
        res.json({ success: true, template });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update template
app.put('/api/templates/:id', async (req, res) => {
    try {
        const templateId = req.params.id;
        const { name, content, variables } = req.body;
        
        const templateIndex = templates.findIndex(t => t.id === templateId);
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
        
        await saveData();
        res.json({ success: true, template: templates[templateIndex] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete template
app.delete('/api/templates/:id', async (req, res) => {
    try {
        const templateId = req.params.id;
        const templateIndex = templates.findIndex(t => t.id === templateId);
        
        if (templateIndex === -1) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        templates.splice(templateIndex, 1);
        await saveData();
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get contact groups
app.get('/api/contact-groups', (req, res) => {
    res.json(contactGroups);
});

// Create contact group
app.post('/api/contact-groups', async (req, res) => {
    try {
        const { name, contacts = [] } = req.body;
        
        const contactGroup = {
            id: Date.now().toString(),
            name,
            contacts,
            createdAt: new Date().toISOString()
        };
        
        contactGroups.push(contactGroup);
        await saveData();
        
        res.json({ success: true, contactGroup });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update contact group
app.put('/api/contact-groups/:id', async (req, res) => {
    try {
        const groupId = req.params.id;
        const { name, contacts } = req.body;
        
        const groupIndex = contactGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) {
            return res.status(404).json({ error: 'Contact group not found' });
        }
        
        contactGroups[groupIndex] = {
            ...contactGroups[groupIndex],
            name,
            contacts,
            updatedAt: new Date().toISOString()
        };
        
        await saveData();
        res.json({ success: true, contactGroup: contactGroups[groupIndex] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete contact group
app.delete('/api/contact-groups/:id', async (req, res) => {
    try {
        const groupId = req.params.id;
        const groupIndex = contactGroups.findIndex(g => g.id === groupId);
        
        if (groupIndex === -1) {
            return res.status(404).json({ error: 'Contact group not found' });
        }
        
        contactGroups.splice(groupIndex, 1);
        await saveData();
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send message using template
app.post('/api/send-template', async (req, res) => {
    try {
        const { templateId, recipients, variables = {} } = req.body;
        
        if (!isConnected) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }
        
        const template = templates.find(t => t.id === templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        let message = template.content;
        
        // Replace variables in template
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            message = message.replace(regex, variables[key]);
        });
        
        const results = [];
        
        for (const recipient of recipients) {
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const result = await sock.sendMessage(recipient, { text: message });
                results.push({ recipient, success: true, messageId: result.key.id });
                
                // Store sent message
                if (!messages[recipient]) {
                    messages[recipient] = [];
                }
                messages[recipient].push({
                    id: result.key.id,
                    from: 'me',
                    to: recipient,
                    message: { text: message },
                    timestamp: Date.now(),
                    type: 'sent'
                });
                
            } catch (error) {
                results.push({ recipient, success: false, error: error.message });
            }
        }
        
        await saveData();
        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Socket.IO events
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send current status
    socket.emit('connection-status', { connected: isConnected });
    socket.emit('qr-code', qrCodeData);
    socket.emit('contacts-updated', contacts);
    socket.emit('groups-updated', groups);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
    
    // Handle typing indicator
    socket.on('typing', async (data) => {
        if (isConnected && data.chatId) {
            await sock.sendPresenceUpdate('composing', data.chatId);
        }
    });
    
    socket.on('stop-typing', async (data) => {
        if (isConnected && data.chatId) {
            await sock.sendPresenceUpdate('paused', data.chatId);
        }
    });
});

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize application
const init = async () => {
    try {
        // Ensure directories exist
        await fs.ensureDir('./data');
        await fs.ensureDir('./uploads');
        await fs.ensureDir('./auth_info_baileys');
        
        // Initialize store
        initStore();
        
        // Load saved data
        await loadSavedData();
        
        // Connect to WhatsApp
        await connectToWhatsApp();
        
        // Schedule periodic data saves
        cron.schedule('*/5 * * * *', async () => {
            await saveData();
            console.log('Data saved automatically');
        });
        
    } catch (error) {
        console.error('Error initializing application:', error);
    }
};

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`WhatsApp Client server running on port ${PORT}`);
    init();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await saveData();
    if (sock) {
        await sock.logout();
    }
    process.exit(0);
});
