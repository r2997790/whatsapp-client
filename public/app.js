// WhatsApp Web Client - Frontend JavaScript

class WhatsAppClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.currentChat = null;
        this.contacts = new Map();
        this.groups = new Map();
        this.templates = [];
        this.contactGroups = [];
        this.personalizationManager = null;
        
        this.initializeSocket();
        this.bindEvents();
        this.loadInitialData();
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.checkStatus();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        this.socket.on('qr-code', (qrCode) => {
            this.displayQRCode(qrCode);
        });

        this.socket.on('connection-status', (status) => {
            this.updateConnectionStatus(status.connected);
        });

        this.socket.on('contacts-loaded', (contacts) => {
            this.loadContacts(contacts);
        });

        this.socket.on('groups-loaded', (groups) => {
            this.loadGroups(groups);
        });

        this.socket.on('new-message', (message) => {
            this.handleNewMessage(message);
        });

        this.socket.on('message-sent', (message) => {
            this.handleSentMessage(message);
        });
    }

    bindEvents() {
        // Connection status refresh
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.checkStatus();
        });

        // Message sending
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('messageText').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Template management
        document.getElementById('addTemplateBtn').addEventListener('click', () => {
            this.showTemplateModal();
        });

        // Contact group management
        document.getElementById('addContactGroupBtn').addEventListener('click', () => {
            this.showContactGroupModal();
        });

        // Bulk messaging
        document.getElementById('bulkMessageBtn').addEventListener('click', () => {
            this.showBulkMessageModal();
        });

        // Tab change listeners
        document.querySelectorAll('#sidebarTabs button[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                this.handleTabChange(e.target.getAttribute('aria-controls'));
            });
        });
    }

    async loadInitialData() {
        try {
            // Load templates
            const templatesResponse = await fetch('/api/templates');
            if (templatesResponse.ok) {
                this.templates = await templatesResponse.json();
                this.renderTemplates();
            }

            // Load contact groups
            const contactGroupsResponse = await fetch('/api/contact-groups');
            if (contactGroupsResponse.ok) {
                this.contactGroups = await contactGroupsResponse.json();
                this.renderContactGroups();
            }

            // Initialize PersonalizationManager after data is loaded
            this.initializePersonalizationManager();
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    initializePersonalizationManager() {
        // Initialize PersonalizationManager when contacts and templates are available
        if (typeof PersonalizationManager !== 'undefined') {
            this.personalizationManager = new PersonalizationManager(this);
            console.log('PersonalizationManager initialized');
        } else {
            console.warn('PersonalizationManager not available');
        }
    }

    handleTabChange(activeTabId) {
        // Handle tab-specific initialization and data refresh
        switch (activeTabId) {
            case 'personalization':
                if (this.personalizationManager) {
                    // Refresh data when switching to personalization tab
                    this.personalizationManager.refreshContactData();
                    this.personalizationManager.refreshTemplateData();
                }
                break;
            case 'contacts':
                // Refresh contacts if needed
                this.renderContacts();
                break;
            case 'groups':
                // Refresh groups if needed
                this.renderGroups();
                break;
            case 'tools':
                // Refresh templates and contact groups
                this.renderTemplates();
                this.renderContactGroups();
                break;
        }
    }

    async checkStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            this.updateConnectionStatus(status.connected);
            
            if (status.qrCode) {
                this.displayQRCode(status.qrCode);
            }
            
            console.log('Status:', status);
        } catch (error) {
            console.error('Error checking status:', error);
        }
    }

    displayQRCode(qrCodeData) {
        const qrContainer = document.getElementById('qrCodeContainer');
        qrContainer.innerHTML = `<img src="${qrCodeData}" alt="QR Code" class="img-fluid" style="max-width: 300px;">`;
        
        // Show QR section
        document.getElementById('qrSection').style.display = 'flex';
        document.getElementById('welcomeScreen').style.display = 'none';
    }

    updateConnectionStatus(connected) {
        this.isConnected = connected;
        const statusElement = document.getElementById('connectionStatus');
        
        if (connected) {
            statusElement.textContent = 'Connected';
            statusElement.className = 'badge bg-success me-2';
            
            // Hide QR section and show welcome screen
            document.getElementById('qrSection').style.display = 'none';
            document.getElementById('welcomeScreen').style.display = 'flex';
        } else {
            statusElement.textContent = 'Disconnected';
            statusElement.className = 'badge bg-danger me-2';
            
            // Show QR section
            document.getElementById('qrSection').style.display = 'flex';
            document.getElementById('welcomeScreen').style.display = 'none';
        }
    }

    loadContacts(contacts) {
        this.contacts.clear();
        contacts.forEach(contact => {
            this.contacts.set(contact.jid, contact);
        });
        this.renderContacts();
        
        // Refresh PersonalizationManager data if available
        if (this.personalizationManager) {
            this.personalizationManager.refreshContactData();
        }
    }

    loadGroups(groups) {
        this.groups.clear();
        groups.forEach(group => {
            this.groups.set(group.jid, group);
        });
        this.renderGroups();
        
        // Refresh PersonalizationManager data if available
        if (this.personalizationManager) {
            this.personalizationManager.refreshContactData();
        }
    }

    renderContacts() {
        const contactsList = document.getElementById('contactsList');
        contactsList.innerHTML = '';

        this.contacts.forEach(contact => {
            const contactElement = document.createElement('div');
            contactElement.className = 'contact-item p-2 border-bottom cursor-pointer';
            contactElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="contact-avatar me-3">
                        <i class="fas fa-user-circle fa-2x text-secondary"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0">${contact.name || contact.jid.split('@')[0]}</h6>
                        <small class="text-muted">${contact.jid}</small>
                    </div>
                </div>
            `;
            
            contactElement.addEventListener('click', () => {
                this.openChat(contact);
            });
            
            contactsList.appendChild(contactElement);
        });
    }

    renderGroups() {
        const groupsList = document.getElementById('groupsList');
        groupsList.innerHTML = '';

        this.groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = 'group-item p-2 border-bottom cursor-pointer';
            groupElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="group-avatar me-3">
                        <i class="fas fa-users fa-2x text-secondary"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0">${group.subject}</h6>
                        <small class="text-muted">${group.participants.length} participants</small>
                    </div>
                </div>
            `;
            
            groupElement.addEventListener('click', () => {
                this.openChat(group);
            });
            
            groupsList.appendChild(groupElement);
        });
    }

    renderTemplates() {
        const templatesList = document.getElementById('templatesList');
        templatesList.innerHTML = '';

        this.templates.forEach(template => {
            const templateElement = document.createElement('div');
            templateElement.className = 'template-item p-2 border-bottom';
            templateElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${template.name}</h6>
                        <small class="text-muted">${template.content.substring(0, 50)}...</small>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="whatsAppClient.useTemplate('${template.id}')">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="whatsAppClient.deleteTemplate('${template.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            templatesList.appendChild(templateElement);
        });
        
        // Refresh PersonalizationManager template data if available
        if (this.personalizationManager) {
            this.personalizationManager.refreshTemplateData();
        }
    }

    renderContactGroups() {
        const contactGroupsList = document.getElementById('contactGroupsList');
        contactGroupsList.innerHTML = '';

        this.contactGroups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = 'contact-group-item p-2 border-bottom';
            groupElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${group.name}</h6>
                        <small class="text-muted">${group.contacts.length} contacts</small>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="whatsAppClient.useContactGroup('${group.id}')">
                            <i class="fas fa-users"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="whatsAppClient.deleteContactGroup('${group.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            contactGroupsList.appendChild(groupElement);
        });
    }

    openChat(chatData) {
        this.currentChat = chatData;
        
        // Update chat header
        document.getElementById('chatName').textContent = chatData.name || chatData.subject || chatData.jid.split('@')[0];
        document.getElementById('chatStatus').textContent = chatData.jid;
        
        // Show chat interface
        document.getElementById('qrSection').style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('chatHeader').style.display = 'block';
        document.getElementById('messagesArea').style.display = 'block';
        document.getElementById('messageInput').style.display = 'block';
        
        // Load chat messages
        this.loadChatMessages(chatData.jid);
    }

    async loadChatMessages(chatId) {
        try {
            const response = await fetch(`/api/messages/${encodeURIComponent(chatId)}`);
            if (response.ok) {
                const messages = await response.json();
                this.renderMessages(messages);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    renderMessages(messages) {
        const messagesList = document.getElementById('messagesList');
        messagesList.innerHTML = '';

        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.type === 'sent' ? 'sent' : 'received'} mb-2`;
            
            const timestamp = new Date(message.timestamp).toLocaleTimeString();
            
            messageElement.innerHTML = `
                <div class="message-content p-2 rounded">
                    <div class="message-text">${message.message}</div>
                    <div class="message-time text-muted small">${timestamp}</div>
                </div>
            `;
            
            messagesList.appendChild(messageElement);
        });

        // Scroll to bottom
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    async sendMessage() {
        if (!this.currentChat || !this.isConnected) {
            this.showToast('Please select a chat and ensure WhatsApp is connected', 'warning');
            return;
        }

        const messageText = document.getElementById('messageText').value.trim();
        if (!messageText) {
            return;
        }

        try {
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: this.currentChat.jid,
                    message: messageText,
                    type: 'text'
                }),
            });

            if (response.ok) {
                document.getElementById('messageText').value = '';
                this.showToast('Message sent successfully', 'success');
            } else {
                const error = await response.json();
                this.showToast(`Failed to send message: ${error.error}`, 'danger');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showToast('Error sending message', 'danger');
        }
    }

    handleNewMessage(message) {
        if (this.currentChat && (message.from === this.currentChat.jid || message.to === this.currentChat.jid)) {
            // Add message to current chat
            const messagesList = document.getElementById('messagesList');
            const messageElement = document.createElement('div');
            messageElement.className = 'message received mb-2';
            
            const timestamp = new Date(message.timestamp).toLocaleTimeString();
            
            messageElement.innerHTML = `
                <div class="message-content p-2 rounded">
                    <div class="message-text">${message.message}</div>
                    <div class="message-time text-muted small">${timestamp}</div>
                </div>
            `;
            
            messagesList.appendChild(messageElement);
            messagesList.scrollTop = messagesList.scrollHeight;
        }

        // Show desktop notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New WhatsApp Message', {
                body: message.message,
                icon: '/public/whatsapp-icon.png'
            });
        }
    }

    handleSentMessage(message) {
        if (this.currentChat && (message.from === this.currentChat.jid || message.to === this.currentChat.jid)) {
            // Add message to current chat
            const messagesList = document.getElementById('messagesList');
            const messageElement = document.createElement('div');
            messageElement.className = 'message sent mb-2';
            
            const timestamp = new Date(message.timestamp).toLocaleTimeString();
            
            messageElement.innerHTML = `
                <div class="message-content p-2 rounded">
                    <div class="message-text">${message.message}</div>
                    <div class="message-time text-muted small">${timestamp}</div>
                </div>
            `;
            
            messagesList.appendChild(messageElement);
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    }

    showTemplateModal() {
        // Implementation for template modal
        this.showToast('Template feature will be implemented', 'info');
    }

    showContactGroupModal() {
        // Implementation for contact group modal
        this.showToast('Contact group feature will be implemented', 'info');
    }

    showBulkMessageModal() {
        // Implementation for bulk message modal
        this.showToast('Bulk messaging feature will be implemented', 'info');
    }

    useTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            document.getElementById('messageText').value = template.content;
        }
    }

    async deleteTemplate(templateId) {
        if (confirm('Are you sure you want to delete this template?')) {
            try {
                const response = await fetch(`/api/templates/${templateId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    this.templates = this.templates.filter(t => t.id !== templateId);
                    this.renderTemplates();
                    this.showToast('Template deleted successfully', 'success');
                } else {
                    this.showToast('Failed to delete template', 'danger');
                }
            } catch (error) {
                console.error('Error deleting template:', error);
                this.showToast('Error deleting template', 'danger');
            }
        }
    }

    useContactGroup(groupId) {
        const group = this.contactGroups.find(g => g.id === groupId);
        if (group) {
            this.showToast(`Selected contact group: ${group.name} (${group.contacts.length} contacts)`, 'info');
        }
    }

    async deleteContactGroup(groupId) {
        if (confirm('Are you sure you want to delete this contact group?')) {
            try {
                const response = await fetch(`/api/contact-groups/${groupId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    this.contactGroups = this.contactGroups.filter(g => g.id !== groupId);
                    this.renderContactGroups();
                    this.showToast('Contact group deleted successfully', 'success');
                } else {
                    this.showToast('Failed to delete contact group', 'danger');
                }
            } catch (error) {
                console.error('Error deleting contact group:', error);
                this.showToast('Error deleting contact group', 'danger');
            }
        }
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(toast);
        
        // Show toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
    }
}

// Initialize the WhatsApp client when the page loads
let whatsAppClient;
document.addEventListener('DOMContentLoaded', () => {
    whatsAppClient = new WhatsAppClient();
    
    // Make whatsAppClient globally available for PersonalizationManager
    window.whatsAppClient = whatsAppClient;
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Global functions for inline event handlers
window.whatsAppClient = whatsAppClient;