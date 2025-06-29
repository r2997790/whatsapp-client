// PersonalizationManager.js - WhatsApp Enhanced v3 Personalization System

class PersonalizationManager {
    constructor(whatsAppClient) {
        this.whatsAppClient = whatsAppClient;
        this.tokens = ['{{name}}', '{{phone}}', '{{email}}', '{{company}}', '{{position}}', '{{customField1}}', '{{customField2}}'];
        this.selectedRecipientType = 'single';
        this.selectedContacts = [];
        this.selectedGroup = null;
        this.currentTemplate = null;
        this.statistics = {
            tokenCount: 0,
            recipientCount: 0,
            estimatedMessages: 0
        };
        
        this.initializePersonalization();
    }

    initializePersonalization() {
        this.bindPersonalizationEvents();
        this.setupTokenSystem();
        this.updateStatistics();
    }

    bindPersonalizationEvents() {
        // Template selector events
        const templateSelector = document.getElementById('templateSelector');
        if (templateSelector) {
            templateSelector.addEventListener('change', (e) => {
                this.selectTemplate(e.target.value);
            });
        }

        // Clear template button
        const clearTemplateBtn = document.getElementById('clearTemplateBtn');
        if (clearTemplateBtn) {
            clearTemplateBtn.addEventListener('click', () => {
                this.clearTemplate();
            });
        }

        // Load template button
        const loadTemplateBtn = document.getElementById('loadTemplateBtn');
        if (loadTemplateBtn) {
            loadTemplateBtn.addEventListener('click', () => {
                this.loadSelectedTemplate();
            });
        }

        // Recipient type selector
        const recipientTypeSelector = document.getElementById('recipientType');
        if (recipientTypeSelector) {
            recipientTypeSelector.addEventListener('change', (e) => {
                this.changeRecipientType(e.target.value);
            });
        }

        // Contact selector events
        const contactSelector = document.getElementById('contactSelector');
        if (contactSelector) {
            contactSelector.addEventListener('change', (e) => {
                this.selectSingleContact(e.target.value);
            });
        }

        // Group selector events
        const groupSelector = document.getElementById('groupSelector');
        if (groupSelector) {
            groupSelector.addEventListener('change', (e) => {
                this.selectGroup(e.target.value);
            });
        }

        // Message composer events
        const messageComposer = document.getElementById('personalizedMessage');
        if (messageComposer) {
            messageComposer.addEventListener('input', () => {
                this.updatePreview();
                this.updateStatistics();
            });
        }

        // Token insertion buttons
        document.querySelectorAll('.token-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.insertToken(e.target.dataset.token);
            });
        });

        // Send personalized message button
        const sendPersonalizedBtn = document.getElementById('sendPersonalizedBtn');
        if (sendPersonalizedBtn) {
            sendPersonalizedBtn.addEventListener('click', () => {
                this.sendPersonalizedMessages();
            });
        }

        // Quick personalization buttons
        const quickPersonalizeBtn = document.getElementById('quickPersonalizeBtn');
        if (quickPersonalizeBtn) {
            quickPersonalizeBtn.addEventListener('click', () => {
                this.showQuickPersonalizationModal();
            });
        }

        const bulkPersonalizeBtn = document.getElementById('bulkPersonalizeBtn');
        if (bulkPersonalizeBtn) {
            bulkPersonalizeBtn.addEventListener('click', () => {
                this.showBulkPersonalizationModal();
            });
        }

        const templatePersonalizeBtn = document.getElementById('templatePersonalizeBtn');
        if (templatePersonalizeBtn) {
            templatePersonalizeBtn.addEventListener('click', () => {
                this.showTemplatePersonalizationModal();
            });
        }

        // Modal-specific event handlers
        this.bindModalEvents();
    }

    bindModalEvents() {
        // Quick modal events
        const sendQuickBtn = document.getElementById('sendQuickPersonalizedBtn');
        if (sendQuickBtn) {
            sendQuickBtn.addEventListener('click', () => {
                this.sendQuickPersonalizedMessage();
            });
        }

        // Bulk modal events
        const sendBulkBtn = document.getElementById('sendBulkPersonalizedBtn');
        if (sendBulkBtn) {
            sendBulkBtn.addEventListener('click', () => {
                this.sendBulkPersonalizedMessages();
            });
        }

        // Template modal events
        const useTemplateBtn = document.getElementById('useTemplatePersonalizationBtn');
        if (useTemplateBtn) {
            useTemplateBtn.addEventListener('click', () => {
                this.useTemplatePersonalization();
            });
        }

        // Quick modal contact selector
        const quickContactSelector = document.getElementById('quickModalContactSelector');
        if (quickContactSelector) {
            quickContactSelector.addEventListener('change', () => {
                this.updateQuickModalPreview();
            });
        }

        // Quick modal message input
        const quickMessage = document.getElementById('quickModalMessage');
        if (quickMessage) {
            quickMessage.addEventListener('input', () => {
                this.updateQuickModalPreview();
            });
        }
    }

    setupTokenSystem() {
        // Create token buttons
        const tokenContainer = document.getElementById('tokenButtons');
        if (tokenContainer) {
            tokenContainer.innerHTML = '';
            this.tokens.forEach(token => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-outline-primary btn-sm me-1 mb-1 token-btn';
                btn.dataset.token = token;
                btn.innerHTML = `<i class="fas fa-plus-circle me-1"></i>${token}`;
                btn.addEventListener('click', () => this.insertToken(token));
                tokenContainer.appendChild(btn);
            });
        }

        // Populate template selector
        this.populateTemplateSelector();
        
        // Populate contact/group selectors
        this.populateContactSelectors();
    }

    populateTemplateSelector() {
        const templateSelector = document.getElementById('templateSelector');
        if (templateSelector && this.whatsAppClient.templates) {
            templateSelector.innerHTML = '<option value="">Select a template...</option>';
            this.whatsAppClient.templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                templateSelector.appendChild(option);
            });
        }
    }

    populateContactSelectors() {
        this.populateContactDropdown();
        this.populateGroupDropdown();
        this.populateMultipleContactsSelector();
    }

    populateContactDropdown() {
        const contactSelector = document.getElementById('contactSelector');
        if (contactSelector && this.whatsAppClient.contacts) {
            contactSelector.innerHTML = '<option value="">Select a contact...</option>';
            this.whatsAppClient.contacts.forEach((contact, jid) => {
                const option = document.createElement('option');
                option.value = jid;
                option.textContent = contact.name || jid.split('@')[0];
                contactSelector.appendChild(option);
            });
        }
    }

    populateGroupDropdown() {
        const groupSelector = document.getElementById('groupSelector');
        if (groupSelector && this.whatsAppClient.groups) {
            groupSelector.innerHTML = '<option value="">Select a group...</option>';
            this.whatsAppClient.groups.forEach((group, jid) => {
                const option = document.createElement('option');
                option.value = jid;
                option.textContent = group.subject || jid.split('@')[0];
                groupSelector.appendChild(option);
            });
        }
    }

    populateMultipleContactsSelector() {
        const multipleContactsContainer = document.getElementById('multipleContactsSelector');
        if (multipleContactsContainer && this.whatsAppClient.contacts) {
            multipleContactsContainer.innerHTML = '';
            this.whatsAppClient.contacts.forEach((contact, jid) => {
                const div = document.createElement('div');
                div.className = 'form-check';
                div.innerHTML = `
                    <input class="form-check-input" type="checkbox" value="${jid}" id="contact_${jid}">
                    <label class="form-check-label" for="contact_${jid}">
                        ${contact.name || jid.split('@')[0]}
                    </label>
                `;
                
                const checkbox = div.querySelector('input');
                checkbox.addEventListener('change', () => {
                    this.updateSelectedContacts();
                });
                
                multipleContactsContainer.appendChild(div);
            });
        }
    }

    selectTemplate(templateId) {
        if (templateId) {
            const template = this.whatsAppClient.templates.find(t => t.id === templateId);
            if (template) {
                this.currentTemplate = template;
                document.getElementById('personalizedMessage').value = template.content;
                this.updatePreview();
                this.updateStatistics();
            }
        } else {
            this.currentTemplate = null;
        }
    }

    clearTemplate() {
        document.getElementById('templateSelector').value = '';
        document.getElementById('personalizedMessage').value = '';
        this.currentTemplate = null;
        this.updatePreview();
        this.updateStatistics();
    }

    loadSelectedTemplate() {
        const templateId = document.getElementById('templateSelector').value;
        if (templateId) {
            this.selectTemplate(templateId);
        } else {
            this.whatsAppClient.showToast('Please select a template first', 'warning');
        }
    }

    changeRecipientType(type) {
        this.selectedRecipientType = type;
        
        // Show/hide appropriate selectors
        document.querySelectorAll('.recipient-selector').forEach(selector => {
            selector.style.display = 'none';
        });

        const selectorId = type === 'group' ? 'groupSelectorDiv' : type + 'Selector';
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.style.display = 'block';
        }

        this.updateStatistics();
    }

    selectSingleContact(contactJid) {
        this.selectedContacts = contactJid ? [contactJid] : [];
        this.updatePreview();
        this.updateStatistics();
    }

    selectGroup(groupJid) {
        this.selectedGroup = groupJid;
        this.updateStatistics();
    }

    updateSelectedContacts() {
        const checkboxes = document.querySelectorAll('#multipleContactsSelector input[type="checkbox"]:checked');
        this.selectedContacts = Array.from(checkboxes).map(cb => cb.value);
        this.updatePreview();
        this.updateStatistics();
    }

    insertToken(token) {
        const messageComposer = document.getElementById('personalizedMessage');
        if (messageComposer) {
            const cursorPos = messageComposer.selectionStart;
            const textBefore = messageComposer.value.substring(0, cursorPos);
            const textAfter = messageComposer.value.substring(messageComposer.selectionEnd);
            
            messageComposer.value = textBefore + token + textAfter;
            messageComposer.focus();
            messageComposer.selectionStart = messageComposer.selectionEnd = cursorPos + token.length;
            
            this.updatePreview();
            this.updateStatistics();
        }
    }

    updatePreview() {
        const message = document.getElementById('personalizedMessage').value;
        const previewContainer = document.getElementById('messagePreview');
        
        if (!previewContainer) return;

        if (!message.trim()) {
            previewContainer.innerHTML = '<p class="text-muted">Preview will appear here...</p>';
            return;
        }

        let previews = [];
        let contactsToPreview = [];

        // Determine which contacts to preview
        switch (this.selectedRecipientType) {
            case 'single':
                if (this.selectedContacts.length > 0) {
                    contactsToPreview = [this.selectedContacts[0]];
                }
                break;
            case 'multiple':
                contactsToPreview = this.selectedContacts.slice(0, 3); // Show first 3
                break;
            case 'group':
                if (this.selectedGroup) {
                    const group = this.whatsAppClient.groups.get(this.selectedGroup);
                    if (group && group.participants) {
                        contactsToPreview = group.participants.slice(0, 3);
                    }
                }
                break;
            case 'all':
                contactsToPreview = Array.from(this.whatsAppClient.contacts.keys()).slice(0, 3);
                break;
        }

        // Generate previews
        contactsToPreview.forEach(contactJid => {
            const contact = this.whatsAppClient.contacts.get(contactJid);
            if (contact) {
                const personalizedMessage = this.personalizeMessage(message, contact);
                previews.push({
                    name: contact.name || contactJid.split('@')[0],
                    message: personalizedMessage
                });
            }
        });

        // Display previews
        if (previews.length > 0) {
            previewContainer.innerHTML = previews.map(preview => `
                <div class="preview-item mb-2 p-2 border rounded">
                    <strong class="text-primary">${preview.name}:</strong>
                    <div class="mt-1">${this.escapeHtml(preview.message)}</div>
                </div>
            `).join('');
            
            if (contactsToPreview.length < this.getRecipientCount()) {
                previewContainer.innerHTML += `
                    <div class="text-muted small">
                        <i class="fas fa-info-circle"></i> 
                        Showing ${previews.length} of ${this.getRecipientCount()} previews
                    </div>
                `;
            }
        } else {
            previewContainer.innerHTML = '<p class="text-muted">Select recipients to see preview...</p>';
        }
    }

    personalizeMessage(message, contact) {
        let personalizedMessage = message;
        
        // Replace tokens with contact data
        personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/g, contact.name || 'Friend');
        personalizedMessage = personalizedMessage.replace(/\{\{phone\}\}/g, contact.phone || contact.jid.split('@')[0]);
        personalizedMessage = personalizedMessage.replace(/\{\{email\}\}/g, contact.email || '');
        personalizedMessage = personalizedMessage.replace(/\{\{company\}\}/g, contact.company || '');
        personalizedMessage = personalizedMessage.replace(/\{\{position\}\}/g, contact.position || '');
        personalizedMessage = personalizedMessage.replace(/\{\{customField1\}\}/g, contact.customField1 || '');
        personalizedMessage = personalizedMessage.replace(/\{\{customField2\}\}/g, contact.customField2 || '');
        
        return personalizedMessage;
    }

    updateStatistics() {
        const message = document.getElementById('personalizedMessage').value;
        
        // Count tokens
        const tokenMatches = message.match(/\{\{[^}]+\}\}/g);
        this.statistics.tokenCount = tokenMatches ? tokenMatches.length : 0;
        
        // Count recipients
        this.statistics.recipientCount = this.getRecipientCount();
        
        // Calculate estimated messages
        this.statistics.estimatedMessages = this.statistics.recipientCount;
        
        // Update UI
        document.getElementById('tokenCount').textContent = this.statistics.tokenCount;
        document.getElementById('recipientCount').textContent = this.statistics.recipientCount;
        document.getElementById('estimatedMessages').textContent = this.statistics.estimatedMessages;
    }

    getRecipientCount() {
        switch (this.selectedRecipientType) {
            case 'single':
                return this.selectedContacts.length;
            case 'multiple':
                return this.selectedContacts.length;
            case 'group':
                if (this.selectedGroup) {
                    const group = this.whatsAppClient.groups.get(this.selectedGroup);
                    return group && group.participants ? group.participants.length : 0;
                }
                return 0;
            case 'all':
                return this.whatsAppClient.contacts.size;
            default:
                return 0;
        }
    }

    async sendPersonalizedMessages() {
        const message = document.getElementById('personalizedMessage').value.trim();
        
        if (!message) {
            this.whatsAppClient.showToast('Please enter a message', 'warning');
            return;
        }

        if (this.statistics.recipientCount === 0) {
            this.whatsAppClient.showToast('Please select recipients', 'warning');
            return;
        }

        if (!confirm(`Send ${this.statistics.estimatedMessages} personalized messages?`)) {
            return;
        }

        try {
            let recipients = [];
            
            // Get recipients based on type
            switch (this.selectedRecipientType) {
                case 'single':
                case 'multiple':
                    recipients = this.selectedContacts;
                    break;
                case 'group':
                    if (this.selectedGroup) {
                        const group = this.whatsAppClient.groups.get(this.selectedGroup);
                        recipients = group && group.participants ? group.participants : [];
                    }
                    break;
                case 'all':
                    recipients = Array.from(this.whatsAppClient.contacts.keys());
                    break;
            }

            // Send messages
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < recipients.length; i++) {
                const recipientJid = recipients[i];
                const contact = this.whatsAppClient.contacts.get(recipientJid);
                
                if (contact) {
                    try {
                        const personalizedMessage = this.personalizeMessage(message, contact);
                        
                        const response = await fetch('/api/send-message', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                to: recipientJid,
                                message: personalizedMessage,
                                type: 'text'
                            }),
                        });

                        if (response.ok) {
                            successCount++;
                        } else {
                            errorCount++;
                            console.error(`Failed to send to ${recipientJid}`);
                        }
                        
                        // Add delay between messages (2-5 seconds)
                        if (i < recipients.length - 1) {
                            await this.delay(2000 + Math.random() * 3000);
                        }
                        
                    } catch (error) {
                        errorCount++;
                        console.error(`Error sending to ${recipientJid}:`, error);
                    }
                }
            }

            // Show results
            if (successCount > 0) {
                this.whatsAppClient.showToast(
                    `Successfully sent ${successCount} personalized messages` + 
                    (errorCount > 0 ? ` (${errorCount} failed)` : ''), 
                    errorCount > 0 ? 'warning' : 'success'
                );
                
                // Clear form
                this.clearForm();
            } else {
                this.whatsAppClient.showToast('Failed to send any messages', 'danger');
            }

        } catch (error) {
            console.error('Error sending personalized messages:', error);
            this.whatsAppClient.showToast('Error sending messages', 'danger');
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clearForm() {
        document.getElementById('personalizedMessage').value = '';
        document.getElementById('templateSelector').value = '';
        document.getElementById('recipientType').value = 'single';
        document.getElementById('contactSelector').value = '';
        document.getElementById('groupSelector').value = '';
        
        // Clear multiple contact checkboxes
        document.querySelectorAll('#multipleContactsSelector input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        this.selectedContacts = [];
        this.selectedGroup = null;
        this.currentTemplate = null;
        this.changeRecipientType('single');
        this.updatePreview();
        this.updateStatistics();
    }

    // Modal Functions
    showQuickPersonalizationModal() {
        // Populate quick modal with current contacts
        this.populateQuickModalContacts();
        
        const modal = new bootstrap.Modal(document.getElementById('quickPersonalizationModal'));
        modal.show();
    }

    showBulkPersonalizationModal() {
        const modal = new bootstrap.Modal(document.getElementById('bulkPersonalizationModal'));
        modal.show();
    }

    showTemplatePersonalizationModal() {
        this.populateTemplateModalTemplates();
        
        const modal = new bootstrap.Modal(document.getElementById('templatePersonalizationModal'));
        modal.show();
    }

    populateQuickModalContacts() {
        const contactSelect = document.getElementById('quickModalContactSelector');
        if (contactSelect && this.whatsAppClient.contacts) {
            contactSelect.innerHTML = '<option value="">Select a contact...</option>';
            this.whatsAppClient.contacts.forEach((contact, jid) => {
                const option = document.createElement('option');
                option.value = jid;
                option.textContent = contact.name || jid.split('@')[0];
                contactSelect.appendChild(option);
            });
        }
    }

    populateTemplateModalTemplates() {
        const templateSelect = document.getElementById('templateModalTemplateSelector');
        if (templateSelect && this.whatsAppClient.templates) {
            templateSelect.innerHTML = '<option value="">Select a template...</option>';
            this.whatsAppClient.templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                templateSelect.appendChild(option);
            });
        }
    }

    // Modal action methods
    async sendQuickPersonalizedMessage() {
        const contactJid = document.getElementById('quickModalContactSelector').value;
        const message = document.getElementById('quickModalMessage').value.trim();

        if (!contactJid) {
            this.whatsAppClient.showToast('Please select a contact', 'warning');
            return;
        }

        if (!message) {
            this.whatsAppClient.showToast('Please enter a message', 'warning');
            return;
        }

        try {
            const contact = this.whatsAppClient.contacts.get(contactJid);
            if (contact) {
                const personalizedMessage = this.personalizeMessage(message, contact);
                
                const response = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: contactJid,
                        message: personalizedMessage,
                        type: 'text'
                    }),
                });

                if (response.ok) {
                    this.whatsAppClient.showToast('Quick personalized message sent!', 'success');
                    
                    // Close modal and clear form
                    const modal = bootstrap.Modal.getInstance(document.getElementById('quickPersonalizationModal'));
                    modal.hide();
                    
                    document.getElementById('quickModalContactSelector').value = '';
                    document.getElementById('quickModalMessage').value = '';
                    document.getElementById('quickModalPreview').innerHTML = '<small class="text-muted">Preview will appear here...</small>';
                } else {
                    const error = await response.json();
                    this.whatsAppClient.showToast(`Failed to send message: ${error.error}`, 'danger');
                }
            }
        } catch (error) {
            console.error('Error sending quick personalized message:', error);
            this.whatsAppClient.showToast('Error sending message', 'danger');
        }
    }

    async sendBulkPersonalizedMessages() {
        // Implementation for bulk modal sending
        this.whatsAppClient.showToast('Bulk personalization feature coming soon!', 'info');
    }

    useTemplatePersonalization() {
        const templateId = document.getElementById('templateModalTemplateSelector').value;
        
        if (!templateId) {
            this.whatsAppClient.showToast('Please select a template', 'warning');
            return;
        }

        const template = this.whatsAppClient.templates.find(t => t.id === templateId);
        if (template) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('templatePersonalizationModal'));
            modal.hide();
            
            // Switch to personalization tab
            const personalizationTab = document.getElementById('personalization-tab');
            if (personalizationTab) {
                personalizationTab.click();
            }
            
            // Load template into main form
            document.getElementById('templateSelector').value = templateId;
            this.selectTemplate(templateId);
            
            this.whatsAppClient.showToast(`Template "${template.name}" loaded for personalization!`, 'success');
        }
    }

    updateQuickModalPreview() {
        const contactJid = document.getElementById('quickModalContactSelector').value;
        const message = document.getElementById('quickModalMessage').value;
        const previewDiv = document.getElementById('quickModalPreview');

        if (!contactJid || !message.trim()) {
            previewDiv.innerHTML = '<small class="text-muted">Preview will appear here...</small>';
            return;
        }

        const contact = this.whatsAppClient.contacts.get(contactJid);
        if (contact) {
            const personalizedMessage = this.personalizeMessage(message, contact);
            previewDiv.innerHTML = `
                <div class="border-start border-primary border-3 ps-2">
                    <strong class="text-primary">${contact.name || contactJid.split('@')[0]}:</strong>
                    <div class="mt-1">${this.escapeHtml(personalizedMessage)}</div>
                </div>
            `;
        }
    }

    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public methods for external access
    refreshContactData() {
        this.populateContactSelectors();
        this.updatePreview();
        this.updateStatistics();
    }

    refreshTemplateData() {
        this.populateTemplateSelector();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersonalizationManager;
}