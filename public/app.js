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
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Global functions for inline event handlers
window.whatsAppClient = whatsAppClient;
